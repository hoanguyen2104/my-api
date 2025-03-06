const modal = document.querySelector(".modal");
const modalBody = document.querySelector(".modal__body");
const overlay = document.querySelector(".overlay");
const content = document.querySelector(".content");
const createPost = document.querySelector(".createNewPost");
const authButtons = document.getElementById("auth-buttons");
const userInfo = document.getElementById("user-info");
const userAvatar = document.getElementById("user-avatar");
const userDisplayName = document.getElementById("user-display-name");

const App = {
  isCreating: false,
  apiUrl: "https://my-api-vao1.onrender.com",
  currentUser: JSON.parse(localStorage.getItem("currentUser")) || null,
  currentPage: 1,
  limit: 5,
  totalPages: 0,
  loading: false,

  getPosts: function (page = 1) {
    return fetch(`${App.apiUrl}/posts?page=${page}&limit=${App.limit}`)
      .then((res) => res.json())
      .then((data) => {
        App.totalPages = data.totalPages;
        return data.posts;
      })
      .catch((error) => {
        console.error("Lỗi khi lấy bài viết:", error);
        return [];
      });
  },

  getTime: function () {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes} ${month}/${day}/${year}`;
  },

  getLikedPosts: function () {
    const data = localStorage.getItem("likedPosts");
    return data ? JSON.parse(data) : [];
  },

  closeModal: function () {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
  },

  updateUserProfile: function () {
    if (App.currentUser) {
      authButtons.classList.add("hidden");
      userInfo.classList.remove("hidden");
      userAvatar.src = App.currentUser.avatar ? `data:image/jpeg;base64,${App.currentUser.avatar}` : "https://via.placeholder.com/40";
      userDisplayName.textContent = App.currentUser.displayName;
      createPost.innerHTML = `
        <img src="${App.currentUser.avatar ? `data:image/jpeg;base64,${App.currentUser.avatar}` : "https://via.placeholder.com/40"}" alt="Avatar" class="header__user-avatar" />
        <span>${App.currentUser.displayName}</span>
      `;
    } else {
      authButtons.classList.remove("hidden");
      userInfo.classList.add("hidden");
      createPost.innerHTML = `
        <span>Tạo bài viết mới</span>
        <i class="header__item-icon fa-solid fa-plus"></i>
      `;
    }
  },

  logout: function () {
    App.currentUser = null;
    localStorage.removeItem("currentUser");
    localStorage.removeItem("likedPosts");
    document.getElementById("logout-menu").classList.add("hidden");
    App.updateUserProfile();
    App.renderPost();
  },

  renderPost: async function () {
    App.currentPage = 1;
    const postsList = content.querySelector(".posts-list");
    postsList.innerHTML = "";
    const postsData = await App.getPosts(App.currentPage);
    App.renderPostsToDOM(postsData);
    App.setupLazyLoading();
  },

  renderPostsToDOM: function (postsData) {
    const postsList = content.querySelector(".posts-list");
    const likedPosts = App.getLikedPosts();
    if (postsData && postsData.length > 0) {
      postsData.forEach((e) => {
        const isMyPost = App.currentUser && e.username === App.currentUser.username;
        const isLiked = likedPosts.includes(e.id);
        const postAvatar = isMyPost && App.currentUser.avatar ? `data:image/jpeg;base64,${App.currentUser.avatar}` : "https://via.placeholder.com/50";
        postsList.innerHTML += `
          <div class="content__wrapper">
            <div class="post" id="post-${e.id}">
              <div class="post__header">
                <div class="post__avatar" style="background-image: url('${postAvatar}');"></div>
                <div class="post__info">
                  <h3 class="post__user-name">${e.name}</h3>
                  <div class="post__info-time">${e.time}</div>
                </div>
              </div>
              <div class="post__content">
                <p class="post__paragraph">${e.content}</p>
                <div class="post__image-list">${
                  e.image ? `<img src="data:image/jpeg;base64,${e.image}" alt="image" class="post__image" />` : ""
                }</div>
                <div class="post__analysis">
                  <div class="post__analysis-wrapper">
                    <i class="fa-solid fa-thumbs-up"></i>
                    <span class="like-quantum">${e.likes || 0}</span>
                  </div>
                  <div class="post__analysis-wrapper">${e.comments || 0} Bình luận</div>
                </div>
                <div class="post__control">
                  <button class="post__control-btn post__control-btn--like ${isLiked ? 'liked' : ''}" onclick="App.likePost('${e.id}')">
                    <i class="fa-solid fa-thumbs-up"></i>
                    <span>${isLiked ? 'Liked' : 'Like'}</span>
                  </button>
                  <button class="post__control-btn post__control-btn--commend" onclick="App.showCommentModal('${e.id}')">
                    <i class="fa-solid fa-comment"></i>
                    <span>Bình luận</span>
                  </button>
                  ${
                    isMyPost
                      ? `<button class="post__control-btn post__control-btn--delete" onclick="App.deletePost('${e.id}')">
                          <i class="fa-solid fa-trash"></i>
                          <span>Xóa</span>
                        </button>`
                      : ""
                  }
                </div>
                <div class="post__comments">
                  ${e.commentsList.map((c) => `<p><strong>${c.name}:</strong> ${c.text}</p>`).join("")}
                </div>
              </div>
            </div>
          </div>`;
      });
    }
    const sentinel = document.createElement("div");
    sentinel.id = "sentinel";
    postsList.appendChild(sentinel);
  },

  likePost: function (postId) {
    const likedPosts = App.getLikedPosts();
    const isLiked = likedPosts.includes(postId);
    if (!isLiked) {
      fetch(`${App.apiUrl}/posts/${postId}/like`, { method: "PATCH" })
        .then((res) => res.json())
        .then((updatedPost) => {
          const postElement = document.getElementById(`post-${postId}`);
          postElement.querySelector(".like-quantum").textContent = updatedPost.likes;
          const likeButton = postElement.querySelector(".post__control-btn--like");
          likeButton.classList.add("liked");
          likeButton.querySelector("span").textContent = "Liked";
          likedPosts.push(postId);
          localStorage.setItem("likedPosts", JSON.stringify(likedPosts));
        })
        .catch((error) => console.error("Lỗi khi thích bài viết:", error));
    }
  },

  showCommentModal: function (postId) {
    if (!App.currentUser) {
      window.location.href = "/login";
      return;
    }
    modal.classList.remove("hidden");
    const commentModal = document.createElement("div");
    commentModal.classList.add("commentModal");
    commentModal.innerHTML = `
      <div class="commentModal__close" onclick="App.closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </div>
      <h1 class="commentModal__header">Bình luận</h1>
      <div class="commentModal__body">
        <textarea id="commentText" placeholder="Viết bình luận..."></textarea>
        <button class="btn commentModal__submit" onclick="App.addComment('${postId}')">Gửi</button>
      </div>
    `;
    modalBody.appendChild(commentModal);
  },

  addComment: function (postId) {
    const text = document.getElementById("commentText").value;
    if (!text) {
      alert("Vui lòng nhập bình luận!");
      return;
    }
    fetch(`${App.apiUrl}/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: App.currentUser.displayName, text }),
    })
      .then((res) => res.json())
      .then((newComment) => {
        const postElement = document.getElementById(`post-${postId}`);
        const commentsDiv = postElement.querySelector(".post__comments");
        commentsDiv.innerHTML += `<p><strong>${newComment.name}:</strong> ${newComment.text}</p>`;
        const commentCount = postElement.querySelector(".post__analysis-wrapper:nth-child(2)");
        commentCount.textContent = `${parseInt(commentCount.textContent) + 1} Bình luận`;
        App.closeModal();
      })
      .catch((error) => console.error("Lỗi khi thêm bình luận:", error));
  },

  deletePost: function (postId) {
    if (!App.currentUser) {
      window.location.href = "/login";
      return;
    }
    if (confirm("Bạn có chắc muốn xóa bài viết này?")) {
      fetch(`${App.apiUrl}/posts/${postId}`, { method: "DELETE" })
        .then((res) => {
          if (res.ok) {
            const postElement = document.getElementById(`post-${postId}`);
            postElement.parentElement.remove();
          } else {
            throw new Error("Không thể xóa bài viết!");
          }
        })
        .catch((error) => console.error("Lỗi khi xóa bài viết:", error));
    }
  },

  setupLazyLoading: function () {
    const sentinel = document.getElementById("sentinel");
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !App.loading && App.currentPage < App.totalPages) {
          App.loading = true;
          App.currentPage++;
          const nextPosts = await App.getPosts(App.currentPage);
          App.renderPostsToDOM(nextPosts);
          App.loading = false;
        }
      },
      { rootMargin: "0px 0px 200px 0px" }
    );
    observer.observe(sentinel);
  },

  handleCreatePost: function () {
    if (!App.currentUser) {
      window.location.href = "/login";
      return;
    }
    if (!App.isCreating) {
      modal.classList.remove("hidden");
      const createPost = document.createElement("div");
      createPost.classList.add("createPost");
      createPost.innerHTML = `
        <div class="createPost__close" onclick="App.closeModal(); App.isCreating = false;">
          <i class="fa-solid fa-xmark"></i>
        </div>
        <h1 class="createPost__header">Tạo bài viết</h1>
        <div class="createPost__body">
          <div class="createPost__wrapper">
            <div style="display: flex;">
              <div class="createPost__avt" style="background-image: url('${
                App.currentUser.avatar ? `data:image/jpeg;base64,${App.currentUser.avatar}` : "https://via.placeholder.com/50"
              }');"></div>
              <p class="createPost__name">${App.currentUser.displayName}</p>
            </div>
          </div>
          <div class="createPost__wrapper">
            <textarea class="createPost__content-write" placeholder="${App.currentUser.displayName} bạn đang nghĩ gì thế?"></textarea>
          </div>
          <div class="createPost__wrapper" style="color: var(--white-color);">
            <label style="font-size: 1.6rem;" for="createPost__image-file">Tải một ảnh lên</label>
            <input type="file" id="createPost__image-file" />
            <img class="createPost__pre-image" src="" />
          </div>
          <button style="width: 100%;" class="btn createPost__btn createPost__postSubmit">Đăng</button>
        </div>`;

      let imageFile = null;
      createPost.querySelector("#createPost__image-file").onchange = (e) => {
        const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.gif)$/i;
        if (allowedExtensions.exec(e.target.value)) {
          imageFile = e.target.files[0];
          createPost.querySelector(".createPost__pre-image").src = URL.createObjectURL(imageFile);
        } else {
          alert("Vui lòng upload các file có định dạng: .jpeg/.jpg/.png/.gif");
        }
      };

      createPost.querySelector(".createPost__postSubmit").onclick = (e) => {
        if (
          document.querySelector(".createPost__content-write").value &&
          !e.target.classList.contains("btn--disable")
        ) {
          e.target.classList.add("btn--disable");
          e.target.innerText = "Đang đăng";
          const formData = new FormData();
          formData.append("username", App.currentUser.username);
          formData.append("name", App.currentUser.displayName);
          formData.append("content", document.querySelector(".createPost__content-write").value);
          formData.append("time", App.getTime());
          if (imageFile) formData.append("image", imageFile);

          fetch(`${App.apiUrl}/posts`, {
            method: "POST",
            body: formData,
          })
            .then((res) => {
              if (res.ok) {
                return res.json();
              } else {
                throw new Error("Không thể tạo bài viết!");
              }
            })
            .then((newPost) => {
              console.log("Bài viết mới:", newPost);
              App.closeModal();
              App.isCreating = false;
              App.renderPost();
            })
            .catch((error) => {
              console.error("Lỗi khi tạo bài viết:", error);
              alert(error.message);
              e.target.classList.remove("btn--disable");
              e.target.innerText = "Đăng";
            });
        } else {
          alert("Bạn chưa nhập thông tin!");
        }
      };
      modalBody.appendChild(createPost);
    } else {
      App.closeModal();
    }
    App.isCreating = !App.isCreating;
  },

  start: function () {
    this.updateUserProfile();
    this.renderPost();
    createPost.onclick = () => this.handleCreatePost();
    overlay.onclick = () => this.closeModal();
  },
};

App.start();