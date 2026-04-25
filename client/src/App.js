import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import API from "./api";
import {
  createConversationKeyPair,
  decryptMessageText,
  encryptMessageText,
  generateAccountKeyBundle,
  getConversationKey,
  unlockPrivateKeyFromPassword
} from "./crypto";
import "./App.css";
import quizDeck from "./quizDeck";

const featureCards = [
  { icon: "✦", title: "Bible Reader", text: "Read in a calm, clean space with highlighted focus verses and simple habit prompts.", tone: "lilac" },
  { icon: "🗺", title: "Reading Plans", text: "Choose short, encouraging plans that help teens keep up without feeling overwhelmed.", tone: "gold" },
  { icon: "⚡", title: "Bible Quizzes", text: "Play quick rounds, unlock streak messages, and learn through fun questions.", tone: "mint" },
  { icon: "⏰", title: "Daily Reminders", text: "Set your own three reminder times and build a rhythm that fits your real day.", tone: "peach" }
];

const reactionOptions = [
  { key: "heart", label: "❤️" },
  { key: "pray", label: "🙏" },
  { key: "fire", label: "🔥" },
  { key: "celebrate", label: "🎉" },
  { key: "support", label: "🤝" }
];

const routeItems = [
  { key: "dashboard", label: "dashboard", protected: true },
  { key: "reader", label: "reader", protected: true },
  { key: "wall", label: "wall", protected: true },
  { key: "counseling", label: "counseling", protected: true },
  { key: "reminders", label: "reminders", protected: true },
  { key: "quizzes", label: "quizzes", protected: true },
  { key: "auth", label: "auth", protected: false }
];

const emptyReminderTimes = ["06:30", "12:30", "20:00"];

const bibleVersions = [
  { key: "web", label: "World English Bible (WEB)" },
  { key: "kjv", label: "King James Version (KJV)" },
  { key: "bbe", label: "Bible in Basic English (BBE)" },
  { key: "oeb-us", label: "Open English Bible (OEB-US)" }
];

const bibleBooks = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
  "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
  "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const pageMeta = {
  dashboard: {
    eyebrow: "Overview",
    title: "Your faith dashboard",
    text: "Track your growth, check your rhythm, and jump into each part of Faith Connect from one main page."
  },
  reader: {
    eyebrow: "Scripture",
    title: "Bible reader",
    text: "Look up verses and choose your preferred Bible version while reading."
  },
  wall: {
    eyebrow: "Community",
    title: "Prayer wall",
    text: "Share posts, attach comments, stay anonymous or known, and respond with likes and emoji reactions."
  },
  counseling: {
    eyebrow: "Private help",
    title: "Pastor counseling",
    text: "Private one-to-one conversations between users and pastor-admins for support and prayer."
  },
  reminders: {
    eyebrow: "Habits",
    title: "Reminder rhythm",
    text: "Choose the three times of day when you want Faith Connect to check in with you."
  },
  quizzes: {
    eyebrow: "Play & learn",
    title: "Fun Bible quiz",
    text: "Short quiz rounds with quick feedback to make learning feel lighter and more fun."
  },
  auth: {
    eyebrow: "Welcome",
    title: "Join Faith Connect",
    text: "Create an account or log in to save reminder times, post to the wall, and message pastor-admins."
  }
};

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem("faith-connect-user");
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    localStorage.removeItem("faith-connect-user");
    return null;
  }
};

const normalizePageFromHash = (hashValue) => {
  const cleaned = String(hashValue || "").replace(/^#/, "").trim().toLowerCase();
  const match = routeItems.find((route) => route.key === cleaned);
  return match ? match.key : "auth";
};

const formatTimeLabel = (value) => {
  if (!value) {
    return "--:--";
  }

  const [hour, minute] = value.split(":");
  const numericHour = Number(hour);
  const standardHour = numericHour % 12 || 12;
  const period = numericHour >= 12 ? "PM" : "AM";
  return `${standardHour}:${minute} ${period}`;
};

function App() {
  const [mode, setMode] = useState("register");
  const [currentPage, setCurrentPage] = useState("auth");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [postingToWall, setPostingToWall] = useState(false);
  const [counselingLoading, setCounselingLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [posts, setPosts] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState("");
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", role: "user" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [user, setUser] = useState(readStoredUser);
  const [postForm, setPostForm] = useState({
    mode: "post",
    parentPostId: "",
    content: "",
    category: "prayer",
    isAnonymous: true
  });
  const [counselingForm, setCounselingForm] = useState({
    adminId: "",
    subject: "",
    text: "",
    anonymous: false
  });
  const [messageDraft, setMessageDraft] = useState("");
  const [reminderTimes, setReminderTimes] = useState(
    user?.reminderTimes?.length === 3 ? user.reminderTimes : emptyReminderTimes
  );
  const [bibleVersion, setBibleVersion] = useState("web");
  const [bibleBookQuery, setBibleBookQuery] = useState("John");
  const [bibleChapter, setBibleChapter] = useState("1");
  const [biblePassage, setBiblePassage] = useState("");
  const [bibleVerses, setBibleVerses] = useState([]);
  const [highlightedVerses, setHighlightedVerses] = useState([]);
  const [bibleLoading, setBibleLoading] = useState(false);
  const lastReminderMinute = useRef("");

  const protectedPages = useMemo(
    () => routeItems.filter((item) => item.protected).map((item) => item.key),
    []
  );

  const currentConversation = useMemo(
    () => conversations.find((item) => item._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const currentMeta = pageMeta[currentPage] || pageMeta.auth;
  const quizItem = quizDeck[quizIndex];
  const readerBooks = useMemo(
    () => bibleBooks.filter((book) => book.toLowerCase().includes(bibleBookQuery.toLowerCase())).slice(0, 12),
    [bibleBookQuery]
  );

  const authConfig = useCallback(
    (sessionUser = user) => (sessionUser?.token ? { headers: { Authorization: `Bearer ${sessionUser.token}` } } : {}),
    [user]
  );

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("faith-connect-user", JSON.stringify(nextUser));
  };

  const goToPage = useCallback((page) => {
    if (!user && protectedPages.includes(page)) {
      setCurrentPage("auth");
      setMenuOpen(false);
      window.location.hash = "auth";
      return;
    }

    setCurrentPage(page);
    setMenuOpen(false);
    window.location.hash = page;
  }, [protectedPages, user]);

  const logout = () => {
    setUser(null);
    setAuthError("");
    setStatusMessage("");
    setConversations([]);
    setSelectedConversationId("");
    localStorage.removeItem("faith-connect-user");
    setCurrentPage("auth");
    setMenuOpen(false);
    setMode("login");
    window.location.hash = "auth";
  };

  const getApiErrorMessage = (error, fallback) => {
    if (error?.code === "ERR_NETWORK") {
      return "Cannot reach the server right now. Check the backend URL, MongoDB connection, and deployed API routes.";
    }

    if (typeof error?.response?.data === "string") {
      return error.response.data;
    }

    if (typeof error?.response?.data?.message === "string") {
      return error.response.data.message;
    }

    return fallback;
  };

  const decryptConversationList = useCallback(async (conversationList, sessionUser) => {
    if (!sessionUser?.localPrivateKey) {
      return conversationList.map((conversation) => ({
        ...conversation,
        messages: (conversation.messages || []).map((message) => ({
          ...message,
          text: "[Secure key missing on this device]"
        }))
      }));
    }

    return Promise.all(
      conversationList.map(async (conversation) => {
        try {
          const encryptedKey =
            sessionUser.role === "admin" ? conversation.encryptedKeys?.admin : conversation.encryptedKeys?.user;
          const conversationKey = await getConversationKey(encryptedKey, sessionUser.localPrivateKey);
          const messages = await Promise.all(
            (conversation.messages || []).map(async (message) => ({
              ...message,
              text: await decryptMessageText(message.text, conversationKey)
            }))
          );

          return { ...conversation, messages };
        } catch (error) {
          return {
            ...conversation,
            messages: (conversation.messages || []).map((message) => ({
              ...message,
              text: "[Unable to decrypt message]"
            }))
          };
        }
      })
    );
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/posts`);
      setPosts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not load community posts."));
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/admins`);
      const nextAdmins = Array.isArray(response.data) ? response.data.filter((admin) => admin.publicKey) : [];
      setAdmins(nextAdmins);
      setCounselingForm((current) => ({
        ...current,
        adminId: current.adminId || nextAdmins[0]?._id || ""
      }));
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not load available admins."));
    }
  }, []);

  const fetchConversations = useCallback(async (sessionUser = user) => {
    if (!sessionUser?.token) {
      setConversations([]);
      setSelectedConversationId("");
      return;
    }

    try {
      const response = await axios.get(`${API}/counseling`, authConfig(sessionUser));
      const nextConversations = await decryptConversationList(
        Array.isArray(response.data) ? response.data : [],
        sessionUser
      );
      setConversations(nextConversations);
      setSelectedConversationId((current) => current || nextConversations[0]?._id || "");
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not load counseling conversations."));
    }
  }, [authConfig, decryptConversationList, user]);

  const fetchBiblePassage = useCallback(async (book = bibleBookQuery, chapter = bibleChapter, version = bibleVersion) => {
    const cleanedBook = String(book).trim();
    const cleanedChapter = String(chapter).trim();

    if (!cleanedBook || !cleanedChapter) {
      return;
    }

    setBibleLoading(true);
    try {
      const reference = encodeURIComponent(`${cleanedBook} ${cleanedChapter}`);
      const response = await axios.get(`https://bible-api.com/${reference}?translation=${version}`);
      setBiblePassage(response.data.text || "No chapter found.");
      setBibleVerses(response.data.verses || []);

      const storageKey = `faith-connect-highlights:${version}:${cleanedBook}:${cleanedChapter}`;
      const savedHighlights = localStorage.getItem(storageKey);
      setHighlightedVerses(savedHighlights ? JSON.parse(savedHighlights) : []);
    } catch (error) {
      setBiblePassage("Could not load that chapter right now. Try another book or chapter.");
      setBibleVerses([]);
      setHighlightedVerses([]);
    } finally {
      setBibleLoading(false);
    }
  }, [bibleBookQuery, bibleChapter, bibleVersion]);

  const toggleVerseHighlight = (verseNumber) => {
    const storageKey = `faith-connect-highlights:${bibleVersion}:${bibleBookQuery.trim()}:${String(bibleChapter).trim()}`;

    setHighlightedVerses((current) => {
      const next = current.includes(verseNumber)
        ? current.filter((item) => item !== verseNumber)
        : [...current, verseNumber];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    fetchPosts();
    fetchAdmins();
    fetchBiblePassage("John", "1", "web");
  }, [fetchAdmins, fetchBiblePassage, fetchPosts]);

  useEffect(() => {
    const syncPageWithHash = () => {
      const nextPage = normalizePageFromHash(window.location.hash);
      if (!user && protectedPages.includes(nextPage)) {
        setCurrentPage("auth");
        return;
      }
      setCurrentPage(nextPage);
    };

    syncPageWithHash();
    window.addEventListener("hashchange", syncPageWithHash);
    return () => window.removeEventListener("hashchange", syncPageWithHash);
  }, [protectedPages, user]);

  useEffect(() => {
    if (!user) {
      setReminderTimes(emptyReminderTimes);
      setConversations([]);
      setSelectedConversationId("");
      if (protectedPages.includes(currentPage)) {
        setCurrentPage("auth");
        window.location.hash = "auth";
      }
      return;
    }

    setReminderTimes(user.reminderTimes?.length === 3 ? user.reminderTimes : emptyReminderTimes);
    if (currentPage === "auth") {
      goToPage("dashboard");
    }
    fetchConversations(user);
  }, [currentPage, fetchConversations, goToPage, protectedPages, user]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (lastReminderMinute.current === currentTime) {
        return;
      }

      if (reminderTimes.includes(currentTime)) {
        lastReminderMinute.current = currentTime;
        const message = "Time to pause, pray, and read one verse.";

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Faith Connect Reminder", { body: message });
        } else {
          setStatusMessage(`Reminder: ${message}`);
        }
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [reminderTimes, user]);

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((current) => ({ ...current, [name]: value }));
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  };

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setStatusMessage("");

    try {
      console.log("Simple register data being sent:", registerForm);
      
      const response = await axios.post(`${API}/auth/register`, registerForm);
      
      console.log("Register response:", response.data);

      const nextUser = {
        ...response.data.user,
        token: response.data.token
      };

      persistUser(nextUser);
      setRegisterForm({ username: "", email: "", password: "", role: "user" });
      setStatusMessage("Account created successfully!");
      goToPage("dashboard");
    } catch (error) {
      setAuthError(getApiErrorMessage(error, error.message || "Could not create account."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setStatusMessage("");

    try {
      console.log("Simple login data being sent:", loginForm);
      const response = await axios.post(`${API}/auth/login`, loginForm);
      console.log("Login response:", response.data);

      const nextUser = {
        ...response.data.user,
        token: response.data.token
      };

      persistUser(nextUser);
      setLoginForm({ email: "", password: "" });
      setStatusMessage(`Welcome back, ${response.data.user.username}.`);
      goToPage("dashboard");
    } catch (error) {
      setAuthError(getApiErrorMessage(error, error.message || "Could not log in."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreatePost(event) {
    event.preventDefault();
    if (!user || postingToWall || !postForm.content.trim()) {
      return;
    }

    setPostingToWall(true);
    setStatusMessage("");

    try {
      if (postForm.mode === "comment") {
        if (!postForm.parentPostId) {
          setStatusMessage("Choose a post to comment on first.");
          return;
        }

        const response = await axios.post(`${API}/posts/${postForm.parentPostId}/comment`, {
          userId: user._id,
          text: postForm.content.trim(),
          isAnonymous: postForm.isAnonymous
        });

        setPosts((current) =>
          current.map((post) => (post._id === response.data._id ? response.data : post))
        );
        setStatusMessage("Your comment is live.");
      } else {
        const response = await axios.post(`${API}/posts`, {
          userId: user._id,
          content: postForm.content.trim(),
          category: postForm.category,
          isAnonymous: postForm.isAnonymous
        });

        setPosts((current) => [response.data, ...current]);
        setStatusMessage("Your wall post is live.");
      }

      setPostForm({
        mode: "post",
        parentPostId: "",
        content: "",
        category: "prayer",
        isAnonymous: true
      });
      goToPage("wall");
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not post to the community wall yet."));
    } finally {
      setPostingToWall(false);
    }
  }

  async function handleLikePost(postId) {
    setPosts((current) =>
      current.map((post) => (post._id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post))
    );

    try {
      await axios.put(`${API}/posts/${postId}/like`);
    } catch (error) {
      fetchPosts();
    }
  }

  async function handlePostReaction(postId, key) {
    setPosts((current) =>
      current.map((post) => {
        if (post._id !== postId) {
          return post;
        }

        const existingReaction = post.reactions?.find((item) => item.key === key);
        const nextReactions = existingReaction
          ? (post.reactions || []).map((item) =>
              item.key === key ? { ...item, count: (item.count || 0) + 1 } : item
            )
          : [
              ...(post.reactions || []),
              {
                key,
                label: reactionOptions.find((item) => item.key === key)?.label || key,
                count: 1
              }
            ];

        return { ...post, reactions: nextReactions };
      })
    );

    try {
      await axios.post(`${API}/posts/${postId}/reactions`, { key });
    } catch (error) {
      fetchPosts();
    }
  }

  async function handleCommentLike(postId, commentId) {
    setPosts((current) =>
      current.map((post) =>
        post._id !== postId
          ? post
          : {
              ...post,
              comments: (post.comments || []).map((comment) =>
                comment._id === commentId ? { ...comment, likes: (comment.likes || 0) + 1 } : comment
              )
            }
      )
    );

    try {
      await axios.put(`${API}/posts/${postId}/comments/${commentId}/like`);
    } catch (error) {
      fetchPosts();
    }
  }

  async function handleCommentReaction(postId, commentId, key) {
    setPosts((current) =>
      current.map((post) =>
        post._id !== postId
          ? post
          : {
              ...post,
              comments: (post.comments || []).map((comment) => {
                if (comment._id !== commentId) {
                  return comment;
                }

                const existingReaction = comment.reactions?.find((item) => item.key === key);
                const nextReactions = existingReaction
                  ? (comment.reactions || []).map((item) =>
                      item.key === key ? { ...item, count: (item.count || 0) + 1 } : item
                    )
                  : [
                      ...(comment.reactions || []),
                      {
                        key,
                        label: reactionOptions.find((item) => item.key === key)?.label || key,
                        count: 1
                      }
                    ];

                return { ...comment, reactions: nextReactions };
              })
            }
      )
    );

    try {
      await axios.post(`${API}/posts/${postId}/comments/${commentId}/reactions`, { key });
    } catch (error) {
      fetchPosts();
    }
  }

  async function handleCreateConversation(event) {
    event.preventDefault();
    if (!user || user.role !== "user" || counselingLoading) {
      return;
    }

    if (!counselingForm.subject.trim() || !counselingForm.text.trim()) {
      setStatusMessage("A subject and message are required.");
      return;
    }

    const selectedAdmin = admins.find((admin) => admin._id === counselingForm.adminId);
    if (!selectedAdmin?.publicKey || !user.publicKey) {
      setStatusMessage("Secure counseling is unavailable until both accounts have encryption keys.");
      return;
    }

    setCounselingLoading(true);
    setStatusMessage("");

    try {
      const { conversationKey, encryptedKeys } = await createConversationKeyPair(
        user.publicKey,
        selectedAdmin.publicKey
      );
      const encryptedText = await encryptMessageText(counselingForm.text.trim(), conversationKey);

      const response = await axios.post(
        `${API}/counseling`,
        {
          adminId: counselingForm.adminId,
          anonymous: counselingForm.anonymous,
          subject: counselingForm.subject.trim(),
          text: encryptedText,
          encryptedKeys
        },
        authConfig()
      );

      setStatusMessage("Your encrypted counseling request has been sent.");
      setCounselingForm((current) => ({
        ...current,
        subject: "",
        text: "",
        anonymous: false
      }));
      setSelectedConversationId(response.data._id);
      await fetchConversations(user);
      goToPage("counseling");
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Unable to send your counseling request right now."));
    } finally {
      setCounselingLoading(false);
    }
  }

  async function handleSendReply(event) {
    event.preventDefault();
    if (!user || !currentConversation || !messageDraft.trim() || replyLoading) {
      return;
    }

    setReplyLoading(true);
    setStatusMessage("");

    try {
      const encryptedKey =
        user.role === "admin" ? currentConversation.encryptedKeys?.admin : currentConversation.encryptedKeys?.user;
      const conversationKey = await getConversationKey(encryptedKey, user.localPrivateKey);
      const encryptedText = await encryptMessageText(messageDraft.trim(), conversationKey);

      await axios.post(
        `${API}/counseling/${currentConversation._id}/messages`,
        { text: encryptedText },
        authConfig()
      );

      setMessageDraft("");
      await fetchConversations(user);
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not send that message."));
    } finally {
      setReplyLoading(false);
    }
  }

  async function handleSaveReminders(event) {
    event.preventDefault();
    if (!user || savingReminders) {
      return;
    }

    setSavingReminders(true);
    setStatusMessage("");

    try {
      const response = await axios.put(
        `${API}/users/${user._id}/reminders`,
        { reminderTimes },
        authConfig()
      );

      persistUser({
        ...user,
        reminderTimes: response.data.reminderTimes
      });
      setStatusMessage("Your three daily reminder times have been updated.");
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Could not update reminders."));
    } finally {
      setSavingReminders(false);
    }
  }

  const handleQuizChoice = (option) => {
    if (quizAnswered) {
      return;
    }

    setSelectedQuizOption(option);
    setQuizAnswered(true);
    if (option === quizItem.answer) {
      setQuizScore((current) => current + 1);
    }
  };

  const handleQuizNext = () => {
    if (quizIndex === quizDeck.length - 1) {
      setQuizIndex(0);
      setQuizScore(0);
    } else {
      setQuizIndex((current) => current + 1);
    }

    setQuizAnswered(false);
    setSelectedQuizOption("");
  };

  const authPage = (
    <section className="hero-grid">
      <div className="hero-copy card">
        <span className="mini-badge">Built for daily faith routines</span>
        <h2>
          Grow in Faith
          <span>One Verse</span>
          at a Time
        </h2>
        <p>
          A brighter, softer Faith Connect experience with reading habits, fun quizzes, private counseling,
          anonymous prayer support, and reminders that fit your day.
        </p>
        <div className="hero-stats">
          <div>
            <strong>{posts.length}</strong>
            <span>wall posts</span>
          </div>
          <div>
            <strong>{admins.length}</strong>
            <span>pastor-admins</span>
          </div>
          <div>
            <strong>3x</strong>
            <span>daily reminders</span>
          </div>
        </div>
      </div>

      <div className="auth-card card">
        <div className="auth-switch">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setAuthError("");
              setStatusMessage("");
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setAuthError("");
              setStatusMessage("");
            }}
          >
            Log in
          </button>
        </div>

        {mode === "register" ? (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <input name="username" placeholder="Username" value={registerForm.username} onChange={handleRegisterChange} required />
            <input name="email" type="email" placeholder="Email" value={registerForm.email} onChange={handleRegisterChange} required />
            <input name="password" type="password" placeholder="Password" value={registerForm.password} onChange={handleRegisterChange} required />
            <label className="field-label" htmlFor="role">Join as</label>
            <select id="role" name="role" value={registerForm.role} onChange={handleRegisterChange}>
              <option value="user">User</option>
              <option value="admin">Admin / Pastor</option>
            </select>
            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? "Creating..." : "Create account"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <input name="email" type="email" placeholder="Email" value={loginForm.email} onChange={handleLoginChange} required />
            <input name="password" type="password" placeholder="Password" value={loginForm.password} onChange={handleLoginChange} required />
            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? "Logging in..." : "Continue"}
            </button>
          </form>
        )}

        {authError ? <p className="form-note error">{authError}</p> : null}
        {statusMessage ? <p className="form-note success">{statusMessage}</p> : null}
      </div>
    </section>
  );

  const dashboardPage = (
    <>
      <section className="hero-grid">
        <div className="hero-copy card">
          <span className="mini-badge">Everything in one place</span>
          <h2>
            Grow in Faith
            <span>One Verse</span>
            at a Time
          </h2>
          <p>
            Jump into your daily rhythm, check the wall, message a pastor-admin, and keep your reading habit moving.
          </p>
          <div className="hero-stats">
            <div>
              <strong>{posts.length}</strong>
              <span>wall posts</span>
            </div>
            <div>
              <strong>{admins.length}</strong>
              <span>pastor-admins</span>
            </div>
            <div>
              <strong>{conversations.length}</strong>
              <span>private chats</span>
            </div>
          </div>
        </div>

        <div className="card section-card">
          <p className="eyebrow">{currentMeta.eyebrow}</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
          <div className="mini-stack">
            <button type="button" className="primary-button" onClick={() => goToPage("wall")}>Go to wall</button>
            <button type="button" className="soft-button" onClick={() => goToPage("reader")}>Open Bible reader</button>
            <button type="button" className="soft-button" onClick={() => goToPage("counseling")}>Open counseling</button>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        {featureCards.map((item) => (
          <article key={item.title} className={`feature-card card tone-${item.tone}`}>
            <div className="feature-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="card section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Overview</p>
                <h3>Your faith dashboard</h3>
              </div>
              {user ? <span className="user-chip">{user.role}</span> : null}
            </div>

            <div className="dashboard-panels">
              <div className="mini-panel">
                <h4>Prayer wall</h4>
                <p>Choose whether to share a new post or attach a comment to an existing one.</p>
              </div>
              <div className="mini-panel">
                <h4>Pastor counseling</h4>
                <p>Private one-to-one conversations between users and admins for support.</p>
              </div>
              <div className="mini-panel">
                <h4>Custom reminders</h4>
                <p>Morning, midday, and evening prompts at {reminderTimes.map(formatTimeLabel).join(", ")}.</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="side-column">
          <article className="card section-card compact">
            <p className="eyebrow">Today’s rhythm</p>
            <h3>Reminder snapshots</h3>
            <div className="mini-stack">
              {reminderTimes.map((time, index) => (
                <div key={`${time}-${index}`} className="small-stat">
                  <strong>{formatTimeLabel(time)}</strong>
                  <span>{["Morning", "Midday", "Evening"][index]}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card compact">
            <p className="eyebrow">Community tone</p>
            <h3>Safe sharing options</h3>
            <ul className="check-list">
              <li>Choose post or comment</li>
              <li>Anonymous or known sharing</li>
              <li>Likes and emoji reactions</li>
              <li>Private user-to-admin counseling</li>
            </ul>
          </article>
        </aside>
      </section>
    </>
  );

  const wallPage = (
    <section className="content-grid page-layout">
      <div className="main-column">
        <article className="card section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Community</p>
              <h3>Prayer wall, comments, and reactions</h3>
            </div>
          </div>

          {user ? (
            <form className="stack-form" onSubmit={handleCreatePost}>
              <div className="inline-fields">
                <select
                  value={postForm.mode}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      mode: event.target.value,
                      parentPostId: event.target.value === "comment" ? current.parentPostId : ""
                    }))
                  }
                >
                  <option value="post">Create a post</option>
                  <option value="comment">Write a comment</option>
                </select>

                <select
                  value={postForm.isAnonymous ? "anonymous" : "known"}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      isAnonymous: event.target.value === "anonymous"
                    }))
                  }
                >
                  <option value="anonymous">Post anonymously</option>
                  <option value="known">Post with my name</option>
                </select>
              </div>

              {postForm.mode === "comment" ? (
                <select
                  value={postForm.parentPostId}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, parentPostId: event.target.value }))
                  }
                  required
                >
                  <option value="">Choose a post to comment on</option>
                  {posts.map((post) => (
                    <option key={post._id} value={post._id}>
                      {(post.authorName || "Anonymous").slice(0, 20)}: {post.content.slice(0, 45)}
                    </option>
                  ))}
                </select>
              ) : null}

              <textarea
                rows="4"
                placeholder={
                  postForm.mode === "comment"
                    ? "Write your comment..."
                    : "Share a prayer request, praise report, or encouragement..."
                }
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                required
              />

              <div className="inline-fields">
                <select
                  disabled={postForm.mode === "comment"}
                  value={postForm.category}
                  onChange={(event) => setPostForm((current) => ({ ...current, category: event.target.value }))}
                >
                  <option value="prayer">Prayer request</option>
                  <option value="praise">Praise report</option>
                  <option value="testimony">Testimony</option>
                  <option value="encouragement">Encouragement</option>
                </select>
                <div className="composer-note">
                  {postForm.mode === "comment"
                    ? "Comments attach to one existing post and support anonymous or known replies."
                    : "Posts become new entries on the wall and support likes plus emoji reactions."}
                </div>
              </div>

              <button className="primary-button" type="submit" disabled={postingToWall}>
                {postingToWall ? "Posting..." : postForm.mode === "comment" ? "Send comment" : "Send to wall"}
              </button>
            </form>
          ) : (
            <div className="stack-form">
              <p className="empty-note">Create an account to post to the wall.</p>
              <button type="button" className="primary-button" onClick={() => goToPage("auth")}>Open account</button>
            </div>
          )}

          <div className="post-list">
            {posts.map((post) => (
              <article key={post._id} className="post-card">
                <div className="post-topline">
                  <span className="category-badge">{post.category}</span>
                  <span>{post.authorName || "Anonymous"}</span>
                </div>

                <p>{post.content}</p>

                <div className="reaction-row">
                  <button type="button" className="soft-button" onClick={() => handleLikePost(post._id)}>
                    Like · {post.likes || 0}
                  </button>
                  {reactionOptions.map((reaction) => {
                    const matchingReaction = post.reactions?.find((item) => item.key === reaction.key);
                    return (
                      <button
                        type="button"
                        key={`${post._id}-${reaction.key}`}
                        className="emoji-button"
                        onClick={() => handlePostReaction(post._id, reaction.key)}
                      >
                        {reaction.label} {matchingReaction?.count || 0}
                      </button>
                    );
                  })}
                </div>

                {post.comments?.length ? (
                  <div className="comment-list">
                    {post.comments.map((comment) => (
                      <div key={comment._id} className="comment-card">
                        <div className="comment-head">
                          <strong>{comment.authorName}</strong>
                          <span>{comment.isAnonymous ? "Anonymous comment" : "Known comment"}</span>
                        </div>

                        <p>{comment.text}</p>

                        <div className="reaction-row compact-row">
                          <button type="button" className="soft-button" onClick={() => handleCommentLike(post._id, comment._id)}>
                            Like · {comment.likes || 0}
                          </button>
                          {reactionOptions.map((reaction) => {
                            const matchingReaction = comment.reactions?.find((item) => item.key === reaction.key);
                            return (
                              <button
                                type="button"
                                key={`${comment._id}-${reaction.key}`}
                                className="emoji-button"
                                onClick={() => handleCommentReaction(post._id, comment._id, reaction.key)}
                              >
                                {reaction.label} {matchingReaction?.count || 0}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </div>

      <aside className="side-column">
        <article className="card section-card compact">
          <p className="eyebrow">Page</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
        </article>
      </aside>
    </section>
  );

  const counselingPage = (
    <section className="content-grid page-layout">
      <div className="main-column">
        <article className="card section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Private help</p>
              <h3>Encrypted counseling</h3>
            </div>
          </div>

          {user && user.role === "user" ? (
            <form className="stack-form counseling-form" onSubmit={handleCreateConversation}>
              <input
                placeholder="What do you want support with?"
                value={counselingForm.subject}
                onChange={(event) => setCounselingForm((current) => ({ ...current, subject: event.target.value }))}
                required
              />
              <textarea
                rows="4"
                placeholder="Write your message to a pastor-admin..."
                value={counselingForm.text}
                onChange={(event) => setCounselingForm((current) => ({ ...current, text: event.target.value }))}
                required
              />
              <div className="inline-fields">
                <select
                  value={counselingForm.adminId}
                  onChange={(event) => setCounselingForm((current) => ({ ...current, adminId: event.target.value }))}
                  required
                >
                  <option value="">Choose an admin</option>
                  {admins.map((admin) => (
                    <option key={admin._id} value={admin._id}>{admin.username}</option>
                  ))}
                </select>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={counselingForm.anonymous}
                    onChange={(event) =>
                      setCounselingForm((current) => ({ ...current, anonymous: event.target.checked }))
                    }
                  />
                  Stay anonymous
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={counselingLoading || admins.length === 0}>
                {counselingLoading ? "Encrypting..." : admins.length === 0 ? "No encrypted admin available" : "Start private chat"}
              </button>
            </form>
          ) : null}

          {!user ? (
            <p className="empty-note">Log in to access private counseling.</p>
          ) : (
            <div className="chat-shell">
              <aside className="conversation-list">
                {conversations.length === 0 ? (
                  <p className="empty-note">No conversations yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      type="button"
                      key={conversation._id}
                      className={selectedConversationId === conversation._id ? "conversation-item active" : "conversation-item"}
                      onClick={() => setSelectedConversationId(conversation._id)}
                    >
                      <strong>{conversation.subject}</strong>
                      <span>
                        {user.role === "admin"
                          ? conversation.anonymous
                            ? "Anonymous user"
                            : conversation.userId?.username || "User"
                          : conversation.adminId?.username || "Admin"}
                      </span>
                    </button>
                  ))
                )}
              </aside>

              <div className="chat-window">
                {currentConversation ? (
                  <>
                    <div className="chat-header">
                      <strong>{currentConversation.subject}</strong>
                      <span>
                        {user.role === "admin"
                          ? currentConversation.anonymous
                            ? "Anonymous user"
                            : currentConversation.userId?.username || "User"
                          : `Admin: ${currentConversation.adminId?.username || "Unassigned"}`}
                      </span>
                    </div>

                    <div className="message-list">
                      {currentConversation.messages.map((message, index) => {
                        const mine = String(message.senderId) === String(user._id);
                        return (
                          <div
                            key={`${message.createdAt}-${index}`}
                            className={mine ? "message-bubble mine" : "message-bubble"}
                          >
                            <strong>{mine ? "You" : message.senderName}</strong>
                            <p>{message.text}</p>
                          </div>
                        );
                      })}
                    </div>

                    <form className="reply-form" onSubmit={handleSendReply}>
                      <input
                        placeholder="Write a private reply..."
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                      />
                      <button className="primary-button" type="submit" disabled={replyLoading || !messageDraft.trim()}>
                        {replyLoading ? "Sending..." : "Send"}
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="empty-note">Select a conversation to read messages.</p>
                )}
              </div>
            </div>
          )}
        </article>
      </div>

      <aside className="side-column">
        <article className="card section-card compact">
          <p className="eyebrow">Page</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
          <p className="empty-note">Encrypted messages are stored in the database as unreadable ciphertext.</p>
        </article>
      </aside>
    </section>
  );

  const remindersPage = (
    <section className="content-grid page-layout">
      <div className="main-column">
        <article className="card section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Habits</p>
              <h3>Choose your 3 reminder times</h3>
            </div>
          </div>

          {user ? (
            <form className="stack-form" onSubmit={handleSaveReminders}>
              <div className="reminder-grid">
                {reminderTimes.map((time, index) => (
                  <label key={`${time}-${index}`} className="reminder-card">
                    <span>{["Morning", "Midday", "Evening"][index]}</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) =>
                        setReminderTimes((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                        )
                      }
                    />
                  </label>
                ))}
              </div>

              <button className="primary-button" type="submit" disabled={savingReminders}>
                {savingReminders ? "Saving..." : "Save reminder rhythm"}
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={async () => {
                  if (!("Notification" in window)) {
                    setStatusMessage("This browser does not support reminders notifications.");
                    return;
                  }

                  const permission = await Notification.requestPermission();
                  setStatusMessage(
                    permission === "granted"
                      ? "Browser reminders enabled."
                      : "Notification permission was not granted."
                  );
                }}
              >
                Enable browser notifications
              </button>
            </form>
          ) : (
            <p className="empty-note">Log in so your reminder times can be saved.</p>
          )}
        </article>
      </div>

      <aside className="side-column">
        <article className="card section-card compact">
          <p className="eyebrow">Page</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
        </article>
      </aside>
    </section>
  );

  const readerPage = (
    <section className="content-grid page-layout">
      <div className="main-column">
        <article className="card section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Scripture</p>
              <h3>Book, chapter, and verses</h3>
            </div>
          </div>

          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              fetchBiblePassage();
            }}
          >
            <input
              value={bibleBookQuery}
              onChange={(event) => setBibleBookQuery(event.target.value)}
              placeholder="Search or type a Bible book"
            />

            <div className="inline-fields">
              <input
                type="number"
                min="1"
                value={bibleChapter}
                onChange={(event) => setBibleChapter(event.target.value)}
                placeholder="Chapter"
              />
              <select value={bibleVersion} onChange={(event) => setBibleVersion(event.target.value)}>
                {bibleVersions.map((version) => (
                  <option key={version.key} value={version.key}>{version.label}</option>
                ))}
              </select>
              <button type="submit" className="primary-button" disabled={bibleLoading}>
                {bibleLoading ? "Loading..." : "Load chapter"}
              </button>
            </div>
          </form>

          <div className="book-picker">
            {readerBooks.map((book) => (
              <button type="button" key={book} className="soft-button" onClick={() => setBibleBookQuery(book)}>
                {book}
              </button>
            ))}
          </div>

          <article className="quiz-card bible-reader-card">
            <p className="quiz-progress">
              {bibleBookQuery} {bibleChapter} ({bibleVersion.toUpperCase()})
            </p>

            {bibleVerses.length > 0 ? (
              <div className="verse-list">
                {bibleVerses.map((verse) => (
                  <button
                    type="button"
                    key={`${verse.book_name}-${verse.chapter}-${verse.verse}`}
                    className={`verse-line${highlightedVerses.includes(verse.verse) ? " highlighted" : ""}`}
                    onClick={() => toggleVerseHighlight(verse.verse)}
                  >
                    <span className="verse-number">{verse.verse}</span>
                    <span>{verse.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>{biblePassage || "Choose a book and chapter to begin reading."}</p>
            )}
          </article>
        </article>
      </div>

      <aside className="side-column">
        <article className="card section-card compact">
          <p className="eyebrow">Page</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
          <p className="empty-note">Tip: click any verse to save a highlight on this device.</p>
        </article>
      </aside>
    </section>
  );

  const quizzesPage = (
    <section className="content-grid page-layout">
      <div className="main-column">
        <article className="card section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Play & learn</p>
              <h3>Fun Bible quiz</h3>
            </div>
            <span className="user-chip">Score {quizScore}/{quizDeck.length}</span>
          </div>

          <div className="quiz-card">
            <p className="quiz-progress">Question {quizIndex + 1}/{quizDeck.length}</p>
            <h4>{quizItem.question}</h4>

            <div className="quiz-options">
              {quizItem.options.map((option) => {
                const isCorrect = quizAnswered && option === quizItem.answer;
                const isWrong = quizAnswered && option === selectedQuizOption && option !== quizItem.answer;
                return (
                  <button
                    type="button"
                    key={option}
                    className={`quiz-option${isCorrect ? " correct" : ""}${isWrong ? " wrong" : ""}`}
                    onClick={() => handleQuizChoice(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {quizAnswered ? (
              <div className="quiz-footer">
                <p>
                  {selectedQuizOption === quizItem.answer
                    ? "Nice one. You got it right."
                    : `Good try. The correct answer is ${quizItem.answer}.`}
                </p>
                <button type="button" className="primary-button" onClick={handleQuizNext}>
                  {quizIndex === quizDeck.length - 1 ? "Play again" : "Next question"}
                </button>
              </div>
            ) : (
              <p className="empty-note">Pick an answer to reveal the result.</p>
            )}
          </div>
        </article>
      </div>

      <aside className="side-column">
        <article className="card section-card compact">
          <p className="eyebrow">Page</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
        </article>
      </aside>
    </section>
  );

  const pageContent =
    currentPage === "auth"
      ? authPage
      : currentPage === "dashboard"
        ? dashboardPage
        : currentPage === "reader"
          ? readerPage
          : currentPage === "wall"
            ? wallPage
            : currentPage === "counseling"
              ? counselingPage
              : currentPage === "reminders"
                ? remindersPage
                : quizzesPage;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="layout">
        <header className="card top-header">
          <div className="topbar">
            <div className="brand-mark">
              <span className="brand-icon">✦</span>
              <div>
                <p className="eyebrow">Made for teens</p>
                <h1>Faith Connect</h1>
              </div>
            </div>

            <div className="topbar-actions">
              <span className="badge-pill">VerseVibes Style</span>
              {user ? (
                <button type="button" className="ghost-button" onClick={logout}>Log out</button>
              ) : (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setMode("login");
                    goToPage("auth");
                  }}
                >
                  Open account
                </button>
              )}
            </div>
          </div>

          <nav className="nav-card" aria-label="Primary navigation">
            <div className="nav-brand">
              <div className="nav-logo">⌘</div>
              <strong>VerseVibes</strong>
            </div>

            <button
              type="button"
              className="menu-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span className="menu-toggle-text">Menu</span>
              <span />
              <span />
              <span />
            </button>

            <div className={`tab-strip${menuOpen ? " open" : ""}`}>
              {routeItems.map((route) => (
                <button
                  type="button"
                  key={route.key}
                  className={currentPage === route.key ? "active" : ""}
                  onClick={() => goToPage(route.key)}
                >
                  {route.label}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <section className="card section-card page-intro">
          <p className="eyebrow">{currentMeta.eyebrow}</p>
          <h3>{currentMeta.title}</h3>
          <p>{currentMeta.text}</p>
        </section>

        {statusMessage && currentPage !== "auth" ? (
          <section className="card section-card page-intro">
            <p className="form-note success">{statusMessage}</p>
          </section>
        ) : null}

        {pageContent}
      </main>
    </div>
  );
}

export default App;
