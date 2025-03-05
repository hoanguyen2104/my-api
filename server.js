const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose"); // Đảm bảo dùng mongoose, không phải mongodb
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Kết nối MongoDB Atlas
mongoose
  .connect("mongodb+srv://admin:Hoangn123!@cluster0.mongodb.net/blog?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// Định nghĩa schema cho bài viết
const postSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, default: "Anonymous" },
  content: { type: String, default: "" },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  codePass: { type: String, default: "" },
  time: { type: String, default: new Date().toISOString() },
  avatar: { type: String, default: null },
  image: { type: String, default: null },
  commentsList: [{ name: String, text: String, codePass: String }],
});

const Post = mongoose.model("Post", postSchema);

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
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find();
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

    const newPost = new Post({
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
    });

    await newPost.save();
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
    const post = await Post.findOne({ id });
    if (post) {
      Object.assign(post, req.body);
      await post.save();
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
    const result = await Post.deleteOne({ id });
    if (result.deletedCount > 0) {
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