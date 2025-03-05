const express = require("express");
const multer = require("multer");
const { drive } = require("@googleapis/drive");
const { GoogleAuth } = require("google-auth-library");
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Khởi tạo Google Drive API với Service Account từ biến môi trường
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const driveClient = drive({ version: "v3", auth });

// ID thư mục trên Google Drive
const FOLDER_ID = "1TnL94q6t80PrxgjxGoQvJVnl2F-oGNGe";

// Tải dữ liệu từ Google Drive
async function loadPosts() {
  try {
    const res = await driveClient.files.list({
      q: `'${FOLDER_ID}' in parents name:posts.json`, // Sửa cú pháp tìm kiếm
      fields: "files(id, name)",
    });
    const file = res.data.files.find((f) => f.name === "posts.json");
    if (file) {
      const fileData = await driveClient.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "stream" }
      );
      let data = "";
      return new Promise((resolve) => {
        fileData.data
          .on("data", (chunk) => (data += chunk))
          .on("end", () => {
            console.log("Loaded posts from Drive:", data);
            resolve(JSON.parse(data));
          })
          .on("error", (err) => {
            console.error("Error reading posts from Drive:", err.message);
            resolve([]);
          });
      });
    } else {
      console.log("posts.json not found on Drive, starting with empty array");
      return [];
    }
  } catch (error) {
    console.error("Error loading posts from Drive:", error.message);
    return [];
  }
}

// Lưu dữ liệu lên Google Drive
async function savePosts(posts) {
  try {
    const fileContent = JSON.stringify(posts, null, 2);
    const res = await driveClient.files.list({
      q: `'${FOLDER_ID}' in parents name:posts.json`, // Sửa cú pháp tìm kiếm
      fields: "files(id, name)",
    });
    const file = res.data.files.find((f) => f.name === "posts.json");

    if (file) {
      await driveClient.files.update({
        fileId: file.id,
        media: {
          mimeType: "application/json",
          body: fileContent,
        },
      });
      console.log("Updated posts.json on Drive, file ID:", file.id);
    } else {
      await driveClient.files.create({
        resource: {
          name: "posts.json",
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: "application/json",
          body: fileContent,
        },
      });
      console.log("Created posts.json on Drive");
    }
  } catch (error) {
    console.error("Error saving posts to Drive:", error.message);
  }
}

// Khởi tạo danh sách bài viết
let posts = [];
loadPosts().then((loadedPosts) => {
  posts = loadedPosts;
  console.log("Initial posts loaded:", posts.length);
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// Xử lý yêu cầu OPTIONS (preflight)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

// Lấy danh sách bài viết
app.get("/posts", (req, res) => {
  try {
    console.log("Fetched posts:", posts.length);
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error.message);
    res.status(500).json({ message: "Lỗi server khi lấy bài viết", error: error.message });
  }
});

// Tạo bài viết mới
app.post("/posts", upload.fields([{ name: "avatar" }, { name: "image" }]), async (req, res) => {
  try {
    console.log("POST /posts - Request body:", req.body);
    console.log("POST /posts - Request files:", req.files);

    const newPost = {
      id: Date.now().toString(),
      name: req.body.name || "Anonymous",
      content: req.body.content || "",
      likes: parseInt(req.body.likes) || 0,
      comments: parseInt(req.body.comments) || 0,
      codePass: req.body.codePass || "",
      time: req.body.time || new Date().toISOString(),
      avatar: req.files && req.files.avatar ? req.files.avatar[0].buffer.toString("base64") : null,
      image: req.files && req.files.image ? req.files.image[0].buffer.toString("base64") : null,
      commentsList: [],
    };

    posts.push(newPost);
    await savePosts(posts);
    console.log("Created post:", newPost);
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).json({ message: "Lỗi server khi tạo bài viết", error: error.message });
  }
});

// Cập nhật bài viết
app.patch("/posts/:id", async (req, res) => {
  try {
    console.log(`PATCH /posts/${req.params.id} - Request body:`, req.body);
    const { id } = req.params;
    const post = posts.find((p) => p.id === id);
    if (post) {
      Object.assign(post, req.body);
      await savePosts(posts);
      console.log("Updated post:", post);
      res.json(post);
    } else {
      res.status(404).json({ message: "Bài viết không tồn tại" });
    }
  } catch (error) {
    console.error("Error updating post:", error.message);
    res.status(500).json({ message: "Lỗi server khi cập nhật bài viết", error: error.message });
  }
});

// Xóa bài viết
app.delete("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const postIndex = posts.findIndex((p) => p.id === id);
    if (postIndex !== -1) {
      posts.splice(postIndex, 1);
      await savePosts(posts);
      console.log(`Deleted post with id: ${id}`);
      res.status(204).send();
    } else {
      res.status(404).json({ message: "Bài viết không tồn tại" });
    }
  } catch (error) {
    console.error("Error deleting post:", error.message);
    res.status(500).json({ message: "Lỗi server khi xóa bài viết", error: error.message });
  }
});

// Endpoint kiểm tra mật khẩu admin
app.post("/admin/login", (req, res) => {
  try {
    const { password } = req.body;
    console.log("Admin login attempt with password:", password);
    if (password === "hoangn") {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Mật khẩu không đúng!" });
    }
  } catch (error) {
    console.error("Error in admin login:", error.message);
    res.status(500).json({ message: "Lỗi server khi đăng nhập admin", error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});
