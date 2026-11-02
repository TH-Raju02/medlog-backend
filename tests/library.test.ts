import request from "supertest";
import { createApp } from "../src/app";
import { registerAndLogin } from "./helpers";

const app = createApp();
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("Reminders and Protocol & References", () => {
  it("keeps reminders private to their owner", async () => {
    const owner = await registerAndLogin(app, "owner@example.com");
    const other = await registerAndLogin(app, "other@example.com");
    const auth = { Authorization: `Bearer ${owner.token}` };

    const missing = await request(app).post("/api/v1/reminders").set(auth).send({ dueAt: new Date() });
    expect(missing.status).toBe(400);

    const later = await request(app)
      .post("/api/v1/reminders")
      .set(auth)
      .send({ title: "Review culture", dueAt: new Date(Date.now() + 2 * 86400000) });
    const soon = await request(app)
      .post("/api/v1/reminders")
      .set(auth)
      .send({ title: "Check potassium", dueAt: new Date(Date.now() + 3600000) });
    expect(soon.status).toBe(201);

    const list = await request(app).get("/api/v1/reminders").set(auth);
    expect(list.body.data.map((r: { title: string }) => r.title)).toEqual([
      "Check potassium",
      "Review culture",
    ]);

    const done = await request(app)
      .patch(`/api/v1/reminders/${soon.body.data._id}`)
      .set(auth)
      .send({ completed: true });
    expect(done.body.data.completedAt).toBeDefined();

    const foreign = await request(app)
      .delete(`/api/v1/reminders/${later.body.data._id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(foreign.status).toBe(404);

    const otherList = await request(app)
      .get("/api/v1/reminders")
      .set("Authorization", `Bearer ${other.token}`);
    expect(otherList.body.data).toHaveLength(0);
  });

  it("creates folders, uploads PDFs, serves signed links and deletes recursively", async () => {
    const { token } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };

    const unauthorized = await request(app).get("/api/v1/references");
    expect(unauthorized.status).toBe(401);

    const folder = await request(app)
      .post("/api/v1/references/folders")
      .set(auth)
      .send({ name: "Sensitive folder" });
    expect(folder.status).toBe(201);

    const upload = await request(app)
      .post("/api/v1/references/files")
      .set(auth)
      .field("parentId", folder.body.data._id)
      .attach("file", pdf, { filename: "Emergency DDI file.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);
    expect(upload.body.data.name).toBe("Emergency DDI file");

    const notPdf = await request(app)
      .post("/api/v1/references/files")
      .set(auth)
      .attach("file", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
    expect(notPdf.status).toBe(400);

    const root = await request(app).get("/api/v1/references").set(auth);
    expect(root.body.data.items).toHaveLength(1);

    const inside = await request(app)
      .get("/api/v1/references")
      .query({ parentId: folder.body.data._id })
      .set(auth);
    expect(inside.body.data.folder.name).toBe("Sensitive folder");
    expect(inside.body.data.items).toHaveLength(1);

    const link = await request(app).get(`/api/v1/references/${upload.body.data._id}/link`).set(auth);
    expect(link.status).toBe(200);
    const path = new URL(link.body.data.downloadUrl).pathname + new URL(link.body.data.downloadUrl).search;
    const file = await request(app).get(path);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
    expect(file.headers["content-disposition"]).toContain("attachment");

    const badLink = await request(app).get("/api/v1/references/files/not-a-valid-token-value-123");
    expect(badLink.status).toBe(401);

    const removed = await request(app).delete(`/api/v1/references/${folder.body.data._id}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.data.deleted).toBe(2);
  });
});
