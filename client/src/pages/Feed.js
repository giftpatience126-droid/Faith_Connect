import { useEffect, useState } from "react";
import axios from "axios";
import API from "../api";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");

  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API}/posts`);
      setPosts(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePost = async () => {
    if (!content) return;

    try {
      await axios.post(`${API}/posts`, {
        userId: "123",
        content
      });
      setContent("");
      fetchPosts();
    } catch (err) {
      console.log(err);
    }
  };

  const likePost = async (id) => {
    try {
      await axios.put(`${API}/posts/${id}/like`);
      fetchPosts();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div>
      <h2>Feed</h2>

      <textarea
        placeholder="Share something..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <br />
      <button onClick={handlePost}>Post</button>

      <hr />

      {posts.map((post) => (
        <div key={post._id} style={{ border: "1px solid #ccc", margin: "10px", padding: "10px" }}>
          <p>{post.content}</p>
          <button onClick={() => likePost(post._id)}>
            ❤️ {post.likes}
          </button>
        </div>
      ))}
    </div>
  );
}