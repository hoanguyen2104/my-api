const express = require("express");
const multer = require("multer");
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

let posts = [];

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Cho phép tất cả origin (hoặc thay bằng "https://hoangn.glitch.me" để giới hạn)
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Xử lý yêu cầu OPTIONS (preflight)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200); // Trả về OK cho preflight
});

// Lấy danh sách bài viết
app.get("/posts", (req, res) => {
  res.json(posts);
});

// Tạo bài viết mới
app.post("/posts", upload.fields([{ name: "avatar" }, { name: "image" }]), (req, res) => {
  const newPost = {
    id: Date.now().toString(),
    name: req.body.name,
    content: req.body.content,
    likes: parseInt(req.body.likes) || 0,
    comments: parseInt(req.body.comments) || 0,
    codePass: req.body.codePass,
    time: req.body.time,
    avatar: req.files.avatar ? req.files.avatar[0].buffer.toString("base64") : null,
    image: req.files.image ? req.files.image[0].buffer.toString("base64") : null,
    commentsList: [],
  };
  posts.push(newPost);
  res.status(201).json(newPost);
});

// Cập nhật bài viết
app.patch("/posts/:id", (req, res) => {
  const { id } = req.params;
  const post = posts.find((p) => p.id === id);
  if (post) {
    Object.assign(post, req.body);
    res.json(post);
  } else {
    res.status(404).json({ message: "Bài viết không tồn tại" });
  }
});

// Xóa bài viết
app.delete("/posts/:id", (req, res) => {
  const { id } = req.params;
  const postIndex = posts.findIndex((p) => p.id === id);
  if (postIndex !== -1) {
    posts.splice(postIndex, 1);
    res.status(204).send();
  } else {
    res.status(404).json({ message: "Bài viết không tồn tại" });
  }
});

// Endpoint kiểm tra mật khẩu admin
app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === "hoangn") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Mật khẩu không đúng!" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});