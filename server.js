const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Kết nối MongoDB Atlas
mongoose
  .connect("mongodb+srv://hoang21042009:myPass21042009@cluster0.vbe1d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Định nghĩa schema cho bài viết
const postSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  content: String,
  likes: Number,
  comments: Number,
  codePass: String,
  time: String,
  avatar: String,
  image: String,
  commentsList: [{ name: String, text: String, codePass: String }],
});

const Post = mongoose.model("Post", postSchema);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Hoặc "https://hoangn.glitch.me" để giới hạn
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
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
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi lấy bài viết" });
  }
});

// Tạo bài viết mới
app.post("/posts", upload.fields([{ name: "avatar" }, { name: "image" }]), async (req, res) => {
  try {
    const newPost = new Post({
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
    });
    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tạo bài viết" });
  }
});

// Cập nhật bài viết
app.patch("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findOne({ id });
    if (post) {
      Object.assign(post, req.body);
      await post.save();
      res.json(post);
    } else {
      res.status(404).json({ message: "Bài viết không tồn tại" });
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi cập nhật bài viết" });
  }
});

// Xóa bài viết
app.delete("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Post.deleteOne({ id });
    if (result.deletedCount > 0) {
      res.status(204).send();
    } else {
      res.status(404).json({ message: "Bài viết không tồn tại" });
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi xóa bài viết" });
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