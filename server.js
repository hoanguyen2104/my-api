const express = require("express");
const multer = require("multer");
const fs = require("fs"); // Module để đọc/ghi file
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Đường dẫn tới file JSON
const DATA_FILE = "posts.json";

// Khởi tạo danh sách bài viết từ file JSON, nếu không tồn tại thì dùng mảng rỗng
let posts = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const fileData = fs.readFileSync(DATA_FILE, "utf8");
    posts = JSON.parse(fileData);
  } catch (error) {
    console.error("Error reading posts.json:", error.message);
    posts = [];
  }
} else {
  console.log("posts.json not found, starting with empty array");
}

// Hàm lưu dữ liệu vào file JSON
const savePosts = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
    console.log("Posts saved to posts.json");
  } catch (error) {
    console.error("Error saving posts to posts.json:", error.message);
  }
};

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
app.post("/posts", upload.fields([{ name: "avatar" }, { name: "image" }]), (req, res) => {
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
    savePosts();
    console.log("Created post:", newPost);
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).json({ message: "Lỗi server khi tạo bài viết", error: error.message });
  }
});

// Cập nhật bài viết
app.patch("/posts/:id", (req, res) => {
  try {
    console.log(`PATCH /posts/${req.params.id} - Request body:`, req.body);
    const { id } = req.params;
    const post = posts.find((p) => p.id === id);
    if (post) {
      Object.assign(post, req.body);
      savePosts();
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
app.delete("/posts/:id", (req, res) => {
  try {
    const { id } = req.params;
    const postIndex = posts.findIndex((p) => p.id === id);
    if (postIndex !== -1) {
      posts.splice(postIndex, 1);
      savePosts();
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