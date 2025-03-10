const express = require("express");
const multer = require("multer");
const { drive } = require("@googleapis/drive");
const { GoogleAuth } = require("google-auth-library");
const path = require("path");
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const driveClient = drive({ version: "v3", auth });

const FOLDER_ID = "1TnL94q6t80PrxgjxGoQvJVnl2F-oGNGe";

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
            if (!data || data.trim() === "") resolve([]);
            else resolve(JSON.parse(data));
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
        media: { mimeType: "application/json", body: fileContent },
      });
      console.log(`Updated ${filename} on Drive, file ID:`, file.id);
    } else {
      const newFile = await driveClient.files.create({
        resource: { name: filename, parents: [FOLDER_ID] },
        media: { mimeType: "application/json", body: fileContent },
      });
      console.log(`Created ${filename} on Drive, file ID:`, newFile.data.id);
    }
  } catch (error) {
    console.error(`Error saving ${filename} to Drive:`, error.message);
  }
}

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
app.use(express.static("public")); // Phục vụ file tĩnh từ thư mục public

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

// Phục vụ index.html ở gốc "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Trang đăng nhập
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Trang đăng ký
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

// Trang admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/register", upload.single("avatar"), async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password || !displayName) {
      return res.status(400).json({ message: "Username, password và tên hiển thị là bắt buộc" });
    }
    if (users.find((u) => u.username === username)) {
      return res.status(400).json({ message: "Username đã tồn tại" });
    }

    const newUser = {
      username,
      password,
      displayName,
      avatar: req.file ? req.file.buffer.toString("base64") : null,
    };
    users.push(newUser);
    await saveToDrive("users.json", users);
    console.log("Registered user:", newUser);
    res.status(201).json({ message: "Đăng ký thành công", username });
  } catch (error) {
    console.error("Error registering user:", error.message);
    res.status(500).json({ message: "Lỗi server khi đăng ký" });
  }
});

app.post("/api/login", async (req, res) => {
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
    res.status(200).json({ message: "Đăng nhập thành công", user: { username, displayName: user.displayName, avatar: user.avatar } });
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
});

app.get("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = users.find((u) => u.username === username);
    if (user) {
      res.json({ username: user.username, displayName: user.displayName, avatar: user.avatar });
    } else {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
  } catch (error) {
    console.error("Error fetching user:", error.message);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin người dùng" });
  }
});

app.get("/posts", (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedPosts = posts.slice(startIndex, endIndex).map(post => {
      const user = users.find(u => u.username === post.username);
      return {
        ...post,
        avatar: user ? user.avatar : null // Thêm avatar từ users
      };
    });
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
app.get("/posts/:id", (req, res) => {
  try {
    const postId = req.params.id;
    const post = posts.find(p => p.id === postId);
    if (post) {
      res.json(post);
    } else {
      res.status(404).json({ message: "Không tìm thấy bài viết" });
    }
  } catch (error) {
    console.error("Error fetching post:", error.message);
    res.status(500).json({ message: "Lỗi server khi lấy bài viết" });
  }
});

app.post("/posts", upload.single("image"), async (req, res) => {
  try {
    const newPost = {
      id: Date.now().toString(),
      username: req.body.username || "",
      name: req.body.name,
      content: req.body.content || "",
      likes: 0,
      comments: 0,
      likedBy: [], // Thêm danh sách người Like
      codePass: req.body.codePass || "",
      time: req.body.time || new Date().toISOString(),
      image: req.file ? req.file.buffer.toString("base64") : null,
      commentsList: [],
    };
    posts.push(newPost);
    await saveToDrive("posts.json", posts);
    console.log("Created post:", newPost);
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).json({ message: "Lỗi server khi tạo bài viết" });
  }
});

app.patch("/posts/:id/like", async (req, res) => {
  try {
    const postId = req.params.id;
    const username = req.body.username; // Yêu cầu gửi username
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      if (!username) return res.status(401).json({ message: "Chưa đăng nhập" });
      if (!posts[postIndex].likedBy.includes(username)) {
        posts[postIndex].likes = (posts[postIndex].likes || 0) + 1;
        posts[postIndex].likedBy.push(username);
      }
      await saveToDrive("posts.json", posts);
      console.log(`Liked post ${postId}, new likes: ${posts[postIndex].likes}`);
      res.json(posts[postIndex]);
    } else {
      res.status(404).json({ message: "Không tìm thấy bài viết" });
    }
  } catch (error) {
    console.error("Error liking post:", error.message);
    res.status(500).json({ message: "Lỗi server khi thích bài viết" });
  }
});

app.patch("/posts/:id/unlike", async (req, res) => {
  try {
    const postId = req.params.id;
    const username = req.body.username;
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      if (!username) return res.status(401).json({ message: "Chưa đăng nhập" });
      const likeIndex = posts[postIndex].likedBy.indexOf(username);
      if (likeIndex !== -1) {
        posts[postIndex].likes = Math.max((posts[postIndex].likes || 0) - 1, 0);
        posts[postIndex].likedBy.splice(likeIndex, 1);
      }
      await saveToDrive("posts.json", posts);
      console.log(`Unliked post ${postId}, new likes: ${posts[postIndex].likes}`);
      res.json(posts[postIndex]);
    } else {
      res.status(404).json({ message: "Không tìm thấy bài viết" });
    }
  } catch (error) {
    console.error("Error unliking post:", error.message);
    res.status(500).json({ message: "Lỗi server khi hủy thích bài viết" });
  }
});


app.post("/posts/:id/comment", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, name } = req.body;
    const post = posts.find((p) => p.id === id);
    if (post) {
      const newComment = { name, text, codePass: Math.random().toString() };
      post.commentsList.push(newComment);
      post.comments += 1;
      await saveToDrive("posts.json", posts);
      console.log(`Commented on post ${id}, new comment:`, newComment);
      res.status(201).json(newComment);
    } else {
      res.status(404).json({ message: "Bài viết không tồn tại" });
    }
  } catch (error) {
    console.error("Error commenting on post:", error.message);
    res.status(500).json({ message: "Lỗi server khi bình luận" });
  }
});

app.patch("/posts/:id", async (req, res) => {
  try {
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

app.get("/profile", (req, res) => {
  res.sendFile(__dirname + "/public/profile.html");
});

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

// API lấy danh sách tài khoản
app.get("/admin/users", (req, res) => {
  try {
    res.json(users.map(u => ({ username: u.username, displayName: u.displayName, password: u.password })));
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách tài khoản" });
  }
});

// API xóa tài khoản
app.delete("/admin/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
      await saveToDrive("users.json", users);
      console.log(`Deleted user: ${username}`);
      res.status(204).send();
    } else {
      res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ message: "Lỗi server khi xóa tài khoản" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});

