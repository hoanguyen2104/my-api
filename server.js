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

// Tải dữ liệu từ Google Drive (chung cho posts và users)
async function loadFromDrive(filename) {
  try {
    const res = await driveClient.files.list({
      q: `'${FOLDER_ID}' in parents`,
      fields: "files(id, name)",
    });
    const file = res.data.files.find((f) => f.name === filename);
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
            console.log(`Loaded ${filename} from Drive:`, data);
            if (!data || data.trim() === "") {
              console.log(`${filename} is empty, returning empty array`);
              resolve([]);
            } else {
              try {
                resolve(JSON.parse(data));
              } catch (parseError) {
                console.error(`Error parsing ${filename}:`, parseError.message);
                resolve([]);
              }
            }
          })
          .on("error", (err) => {
            console.error(`Error reading ${filename} from Drive:`, err.message);
            resolve([]);
          });
      });
    } else {
      console.log(`${filename} not found on Drive, starting with empty array`);
      return [];
    }
  } catch (error) {
    console.error(`Error loading ${filename} from Drive:`, error.message);
    return [];
  }
}

// Lưu dữ liệu lên Google Drive (chung cho posts và users)
async function saveToDrive(filename, data) {
  try {
    const fileContent = JSON.stringify(data, null, 2);
    const res = await driveClient.files.list({
      q: `'${FOLDER_ID}' in parents`,
      fields: "files(id, name)",
    });
    const file = res.data.files.find((f) => f.name === filename);

    if (file) {
      await driveClient.files.update({
        fileId: file.id,
        media: {
          mimeType: "application/json",
          body: fileContent,
        },
      });
      console.log(`Updated ${filename} on Drive, file ID:`, file.id);
    } else {
      const newFile = await driveClient.files.create({
        resource: {
          name: filename,
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: "application/json",
          body: fileContent,
        },
      });
      console.log(`Created ${filename} on Drive, file ID:`, newFile.data.id);
    }
  } catch (error) {
    console.error(`Error saving ${filename} to Drive:`, error.message);
  }
}

// Khởi tạo danh sách bài viết và người dùng
let posts = [];
let users = [];

Promise.all([loadFromDrive("posts.json"), loadFromDrive("users.json")]).then(
  ([loadedPosts, loadedUsers]) => {
    posts = loadedPosts;
    users = loadedUsers;
    console.log("Initial posts loaded:", posts.length);
    console.log("Initial users loaded:", users.length);
  }
);

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

// Đăng ký người dùng
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username và password là bắt buộc" });
    }
    if (users.find((u) => u.username === username)) {
      return res.status(400).json({ message: "Username đã tồn tại" });
    }

    const newUser = { username, password };
    users.push(newUser);
    await saveToDrive("users.json", users);
    console.log("Registered user:", newUser);
    res.status(201).json({ message: "Đăng ký thành công", username });
  } catch (error) {
    console.error("Error registering user:", error.message);
    res.status(500).json({ message: "Lỗi server khi đăng ký" });
  }
});

// Đăng nhập người dùng
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username và password là bắt buộc" });
    }

    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) {
      return res.status(401).json({ message: "Username hoặc password không đúng" });
    }

    console.log("User logged in:", username);
    res.status(200).json({ message: "Đăng nhập thành công", username });
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
});

// Lấy danh sách bài viết theo trang
app.get("/posts", (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Trang hiện tại, mặc định là 1
    const limit = parseInt(req.query.limit) || 5; // Số bài viết mỗi trang, mặc định là 5
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedPosts = posts.slice(startIndex, endIndex);
    const totalPosts = posts.length;
    const totalPages = Math.ceil(totalPosts / limit);

    console.log(`Fetched posts: page ${page}, limit ${limit}, total ${totalPosts}`);
    res.json({
      posts: paginatedPosts,
      totalPosts: totalPosts,
      totalPages: totalPages,
      currentPage: page,
    });
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
    await saveToDrive("posts.json", posts);
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
      await saveToDrive("posts.json", posts);
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
      await saveToDrive("posts.json", posts);
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
