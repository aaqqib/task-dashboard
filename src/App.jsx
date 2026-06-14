import { useState, useEffect, useRef } from 'react';

const COLUMNS = [
  { id: 'inbox', name: 'Inbox', icon: '📥', desc: 'Capture, process, decide later', color: 'var(--accent-purple)' },
  { id: 'today', name: 'Today', icon: '📅', desc: 'Focus items for today', color: 'var(--accent-teal)' },
  { id: 'week', name: 'This Week', icon: '📆', desc: 'Important weekly milestones', color: 'var(--accent-blue)' },
  { id: 'later', name: 'Later', icon: '⏳', desc: 'Someday/Maybe backlog', color: 'var(--accent-amber)' },
];

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState({
    telegramToken: '',
    authorizedChatId: '',
    authorizedUsername: '',
    digestEnabled: false,
    digestTimes: ['09:00', '20:00']
  });
  const [telegramStatus, setTelegramStatus] = useState({
    tokenConfigured: false,
    chatIdConfigured: false,
    mode: 'webhook/inactive',
    isKv: false
  });

  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'completed'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null); // category ID or null (All)

  // Task Input States
  const [addingToCol, setAddingToCol] = useState(null); // column id or null
  const [newCardTexts, setNewCardTexts] = useState({ inbox: '', today: '', week: '', later: '' });
  const [selectedAddCategory, setSelectedAddCategory] = useState({ inbox: '', today: '', week: '', later: '' });
  
  // Editing Task States
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingTaskCategory, setEditingTaskCategory] = useState('');
  const editInputRef = useRef(null);

  // New Category Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🏷️');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');

  // Settings Forms States
  const [tokenInput, setTokenInput] = useState('');
  const [chatIdInput, setChatIdInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [digestEnabledInput, setDigestEnabledInput] = useState(false);
  const [digestTimesInput, setDigestTimesInput] = useState('09:00, 20:00');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [testResult, setTestResult] = useState({ status: 'idle', message: '' });
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingTaskId]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchTasks(), fetchCategories(), fetchConfig(), fetchStatus()]);
    setLoading(false);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setTokenInput(data.telegramToken || '');
        setChatIdInput(data.authorizedChatId || '');
        setUsernameInput(data.authorizedUsername || '');
        setDigestEnabledInput(data.digestEnabled || false);
        setDigestTimesInput(data.digestTimes?.join(', ') || '09:00, 20:00');
      }
    } catch (e) {
      console.error('Failed to fetch config:', e);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch telegram status:', e);
    }
  };

  // Add Task
  const handleAddTask = async (columnId) => {
    const text = newCardTexts[columnId].trim();
    if (!text) return;
    const categoryId = selectedAddCategory[columnId] || null;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, status: columnId, categoryId }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks((prev) => [...prev, newTask]);
        setNewCardTexts((prev) => ({ ...prev, [columnId]: '' }));
        setSelectedAddCategory((prev) => ({ ...prev, [columnId]: '' }));
        setAddingToCol(null);
      }
    } catch (e) {
      console.error('Error adding task:', e);
    }
  };

  // Move Task
  const handleMoveTask = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch (e) {
      console.error('Error moving task:', e);
    }
  };

  // Start Inline Editing
  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
    setEditingTaskCategory(task.categoryId || '');
  };

  // Save Inline Edit
  const saveEditing = async (id) => {
    if (!editingText.trim()) return cancelEditing();

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editingText, categoryId: editingTaskCategory || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        cancelEditing();
      }
    } catch (e) {
      console.error('Error updating task text:', e);
    }
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingText('');
    setEditingTaskCategory('');
  };

  // Delete Task
  const handleDeleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  // Create Category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName,
          emoji: newCatEmoji,
          color: newCatColor,
        }),
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories((prev) => [...prev, newCat]);
        setNewCatName('');
        setNewCatEmoji('🏷️');
      }
    } catch (e) {
      console.error('Error creating category:', e);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category? Any tasks tagged with this category will become untagged.')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        // Update local tasks to remove deleted category
        setTasks((prev) => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t));
        if (selectedCategoryFilter === id) {
          setSelectedCategoryFilter(null);
        }
      }
    } catch (e) {
      console.error('Error deleting category:', e);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveStatus({ status: 'loading', message: 'Saving configuration...' });
    
    const times = digestTimesInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramToken: tokenInput,
          authorizedChatId: chatIdInput,
          authorizedUsername: usernameInput,
          digestEnabled: digestEnabledInput,
          digestTimes: times
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSaveStatus({ status: 'success', message: 'Settings saved and server updated!' });
        fetchStatus();
        setTimeout(() => setSaveStatus({ status: 'idle', message: '' }), 3000);
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      setSaveStatus({ status: 'error', message: 'Failed to save settings: ' + err.message });
    }
  };

  // Test Telegram Message
  const handleTestTelegram = async () => {
    setTestResult({ status: 'loading', message: 'Sending test message...' });
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ status: 'success', message: 'Test message sent successfully! Check Telegram.' });
      } else {
        setTestResult({ status: 'error', message: `Failed: ${data.error || data.description || 'Unknown error'}` });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: `Connection error: ${e.message}` });
    }
    setTimeout(() => setTestResult({ status: 'idle', message: '' }), 5000);
  };

  // Set Vercel Webhook
  const handleDeployWebhook = async (url) => {
    setSaveStatus({ status: 'loading', message: 'Configuring Telegram Webhook...' });
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus({
          status: 'success',
          message: url 
            ? `Webhook deployed to Telegram successfully!` 
            : `Telegram Webhook cleared. Polling mode reactivated.`
        });
        fetchStatus();
      } else {
        setSaveStatus({ status: 'error', message: `Webhook error: ${data.error || 'Server error'}` });
      }
    } catch (e) {
      setSaveStatus({ status: 'error', message: `Webhook setup request failed: ${e.message}` });
    }
    setTimeout(() => setSaveStatus({ status: 'idle', message: '' }), 5000);
  };

  const suggestWebhookUrl = () => {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      alert("Webhook configuration requires a public URL. This is used when deploying to Vercel. Locally, the server automatically uses polling mode!");
      return;
    }
    setWebhookUrlInput(`${origin}/api/webhook`);
  };

  // Group tasks
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const completedTasks = tasks.filter((t) => t.status === 'done');

  // Filter tasks based on category selection
  const filteredActiveTasks = selectedCategoryFilter 
    ? activeTasks.filter(t => t.categoryId === selectedCategoryFilter)
    : activeTasks;

  const getTasksByCol = (columnId) => {
    return filteredActiveTasks.filter((t) => t.status === columnId || (columnId === 'inbox' && !t.status));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at top, #0c1222, #070a14)' }}>
      {/* Header */}
      <header className="glass-panel" style={{ position: 'sticky', top: 0, zIndex: 10, padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Focus Dashboard</h1>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Telegram Bot: {' '}
              {telegramStatus.tokenConfigured && telegramStatus.chatIdConfigured ? (
                <span style={{ color: 'hsl(var(--accent-green))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--accent-green))', display: 'inline-block' }}></span>
                  Connected ({telegramStatus.mode})
                </span>
              ) : (
                <span style={{ color: 'hsl(var(--accent-amber))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--accent-amber))', display: 'inline-block' }}></span>
                  Not Paired (Local Only)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Navigation / Tabs */}
        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 'var(--border-radius-md)' }}>
          <button
            onClick={() => setActiveTab('board')}
            style={{
              background: activeTab === 'board' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: activeTab === 'board' ? '#fff' : 'hsl(var(--text-muted))',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📋 Focus Board
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            style={{
              background: activeTab === 'completed' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: activeTab === 'completed' ? '#fff' : 'hsl(var(--text-muted))',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ✅ Completed ({completedTasks.length})
          </button>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        >
          ⚙️ Settings
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: 32, maxWidth: 1600, width: '100%', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }}></div>
            <p style={{ color: 'hsl(var(--text-muted))' }}>Loading your task space...</p>
          </div>
        ) : activeTab === 'board' ? (
          /* Kanban Board View */
          <>
            {/* Category Filter Bar */}
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28, padding: '12px 24px', borderRadius: 'var(--border-radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Categories:</span>
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  style={{
                    background: selectedCategoryFilter === null ? 'rgba(28, 196, 173, 0.25)' : 'rgba(255,255,255,0.04)',
                    color: selectedCategoryFilter === null ? '#fff' : 'hsl(var(--text-muted))',
                    border: selectedCategoryFilter === null ? '1px solid hsl(var(--accent-teal))' : '1px solid rgba(255,255,255,0.05)',
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  🌐 All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    style={{
                      background: selectedCategoryFilter === cat.id ? `${cat.color}25` : 'rgba(255,255,255,0.04)',
                      color: selectedCategoryFilter === cat.id ? '#fff' : 'hsl(var(--text-muted))',
                      border: selectedCategoryFilter === cat.id ? `1px solid ${cat.color}` : '1px solid rgba(255,255,255,0.05)',
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsManageCategoriesOpen(true)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  color: 'hsl(var(--text-muted))',
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--accent-teal))'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'hsl(var(--text-muted))'; }}
              >
                📁 Edit Categories
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
              {COLUMNS.map((col) => {
                const colTasks = getTasksByCol(col.id);
                return (
                  <div
                    key={col.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--border-radius-lg)',
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 'calc(100vh - 250px)',
                      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {/* Column Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${col.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{col.icon}</span>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{col.name}</h3>
                      </div>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                        {colTasks.length}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic', marginBottom: 12 }}>
                      {col.desc}
                    </p>

                    {/* Tasks List */}
                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4, minHeight: 40 }}>
                      {colTasks.map((task) => {
                        const category = categories.find((c) => c.id === task.categoryId);
                        return (
                          <div
                            key={task.id}
                            className="glass-card animate-slide-in"
                            onDoubleClick={() => startEditing(task)}
                            style={{
                              borderRadius: 'var(--border-radius-md)',
                              padding: 16,
                              position: 'relative',
                              cursor: 'pointer',
                            }}
                          >
                            {editingTaskId === task.id ? (
                              /* Inline Editing Mode */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <textarea
                                  ref={editInputRef}
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      saveEditing(task.id);
                                    } else if (e.key === 'Escape') {
                                      cancelEditing();
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    background: 'hsl(var(--bg-input))',
                                    border: '1px solid hsl(var(--border-color))',
                                    color: '#fff',
                                    borderRadius: 'var(--border-radius-sm)',
                                    padding: 8,
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    resize: 'vertical',
                                    minHeight: 60
                                  }}
                                />
                                {/* Category Selection inside edit */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Category:</span>
                                  <select
                                    value={editingTaskCategory}
                                    onChange={(e) => setEditingTaskCategory(e.target.value)}
                                    style={{
                                      background: 'hsl(var(--bg-input))',
                                      border: '1px solid hsl(var(--border-color))',
                                      color: '#fff',
                                      padding: '4px 8px',
                                      borderRadius: 'var(--border-radius-sm)',
                                      fontSize: 12,
                                      outline: 'none',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <option value="">🏷️ None</option>
                                    {categories.map((cat) => (
                                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <button onClick={cancelEditing} style={{ background: 'transparent', color: 'hsl(var(--text-muted))', border: 'none', fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}>
                                    Cancel
                                  </button>
                                  <button onClick={() => saveEditing(task.id)} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, padding: '4px 10px', cursor: 'pointer' }}>
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Standard View Mode */
                              <>
                                {/* Category Chip */}
                                {category && (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      background: `${category.color}18`,
                                      color: category.color,
                                      border: `1px solid ${category.color}35`,
                                      marginBottom: '8px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    <span>{category.emoji}</span>
                                    <span>{category.name}</span>
                                  </div>
                                )}
                                
                                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#fff', wordBreak: 'break-word', paddingRight: 8 }}>
                                  {task.text}
                                </div>
                                
                                {/* Hover Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {COLUMNS.filter(c => c.id !== col.id).map(c => (
                                      <button
                                        key={c.id}
                                        onClick={() => handleMoveTask(task.id, c.id)}
                                        title={`Move to ${c.name}`}
                                        style={{
                                          background: 'rgba(255,255,255,0.03)',
                                          border: 'none',
                                          color: 'hsl(var(--text-muted))',
                                          padding: '3px 6px',
                                          borderRadius: 4,
                                          fontSize: 11,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s',
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'hsl(var(--text-muted))'; }}
                                      >
                                        {c.icon}
                                      </button>
                                    ))}
                                  </div>

                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={() => handleMoveTask(task.id, 'done')}
                                      title="Mark Completed"
                                      style={{
                                        background: 'rgba(28, 196, 173, 0.1)',
                                        border: 'none',
                                        color: 'hsl(var(--accent-teal))',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        transition: 'all 0.2s',
                                      }}
                                      onMouseOver={(e) => { e.currentTarget.style.background = 'hsl(var(--accent-teal))'; e.currentTarget.style.color = '#000'; }}
                                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(28, 196, 173, 0.1)'; e.currentTarget.style.color = 'hsl(var(--accent-teal))'; }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      title="Delete Task"
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: 'none',
                                        color: 'hsl(var(--accent-red))',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: 11,
                                        transition: 'all 0.2s',
                                      }}
                                      onMouseOver={(e) => { e.currentTarget.style.background = 'hsl(var(--accent-red))'; e.currentTarget.style.color = '#fff'; }}
                                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'hsl(var(--accent-red))'; }}
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {colTasks.length === 0 && (
                        <div style={{ padding: '24px 0', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-dim))', fontSize: 13 }}>
                          No tasks active
                        </div>
                      )}
                    </div>

                    {/* Add Card Control */}
                    {addingToCol === col.id ? (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          placeholder="Type task details..."
                          value={newCardTexts[col.id]}
                          onChange={(e) => setNewCardTexts({ ...newCardTexts, [col.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask(col.id);
                            else if (e.key === 'Escape') setAddingToCol(null);
                          }}
                          style={{
                            width: '100%',
                            background: 'hsl(var(--bg-input))',
                            border: '1px solid hsl(var(--border-color))',
                            color: '#fff',
                            padding: '10px 14px',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 14,
                            outline: 'none',
                          }}
                          autoFocus
                        />
                        {/* Select Category when adding task */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <select
                            value={selectedAddCategory[col.id] || ''}
                            onChange={(e) => setSelectedAddCategory({ ...selectedAddCategory, [col.id]: e.target.value })}
                            style={{
                              background: 'hsl(var(--bg-input))',
                              border: '1px solid hsl(var(--border-color))',
                              color: '#fff',
                              padding: '6px 10px',
                              borderRadius: 'var(--border-radius-sm)',
                              fontSize: 12,
                              outline: 'none',
                              cursor: 'pointer',
                              flex: 1
                            }}
                          >
                            <option value="">🏷️ Select Tag...</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleAddTask(col.id)}
                              style={{
                                background: 'hsl(var(--accent-teal))',
                                color: '#000',
                                border: 'none',
                                borderRadius: 'var(--border-radius-sm)',
                                padding: '6px 12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                            >
                              Add
                            </button>
                            <button
                              onClick={() => {
                                setAddingToCol(null);
                                setSelectedAddCategory({ ...selectedAddCategory, [col.id]: '' });
                              }}
                              style={{
                                background: 'transparent',
                                color: 'hsl(var(--text-muted))',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToCol(col.id)}
                        style={{
                          marginTop: 14,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px dashed rgba(255,255,255,0.05)',
                          color: 'hsl(var(--text-muted))',
                          padding: '10px 0',
                          borderRadius: 'var(--border-radius-md)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff' }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'hsl(var(--text-muted))' }}
                      >
                        <span>+</span> Add card
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Completed Logs View */
          <div className="glass-panel" style={{ borderRadius: 'var(--border-radius-lg)', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20 }}>Completed Tasks log</h2>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>History of tasks completed successfully</p>
              </div>
              {completedTasks.length > 0 && (
                <button
                  onClick={async () => {
                    if (confirm('This will delete all completed history permanently. Proceed?')) {
                      for (const t of completedTasks) {
                        await fetch(`/api/tasks/${t.id}`, { method: 'DELETE' });
                      }
                      fetchTasks();
                    }
                  }}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--accent-red))', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Clear All History
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {completedTasks.map((task) => {
                const category = categories.find((c) => c.id === task.categoryId);
                return (
                  <div
                    key={task.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {category && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '8px',
                              background: `${category.color}12`,
                              color: category.color,
                              border: `1px solid ${category.color}25`,
                            }}
                          >
                            {category.emoji} {category.name}
                          </span>
                        )}
                        <div style={{ fontSize: 15, textDecoration: 'line-through', color: 'hsl(var(--text-muted))' }}>
                          {task.text}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-dim))', marginTop: 6 }}>
                        ✓ Completed on {new Date(task.completedAt || task.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleMoveTask(task.id, 'inbox')}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'hsl(var(--text-muted))',
                          padding: '6px 12px',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#fff'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                      >
                        Undo / Restore
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: 'none',
                          color: 'hsl(var(--accent-red))',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}

              {completedTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-dim))' }}>
                  <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📈</span>
                  No completed tasks yet. Finish some items on your board!
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Categories Modal */}
      {isManageCategoriesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div className="glass-panel animate-slide-in" style={{ width: '100%', maxWidth: 550, borderRadius: 'var(--border-radius-lg)', padding: 32, border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20 }}>Manage Categories</h2>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Create and organize tags for your tasks</p>
              </div>
              <button
                onClick={() => setIsManageCategoriesOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Existing Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
              {categories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }}></span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--accent-red))', border: 'none', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    🗑
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'hsl(var(--text-dim))', fontSize: 13 }}>
                  No categories created yet.
                </div>
              )}
            </div>

            {/* Create Category Form */}
            <form onSubmit={handleAddCategory} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>Create New Category</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Emoji</label>
                  <input
                    value={newCatEmoji}
                    onChange={(e) => setNewCatEmoji(e.target.value)}
                    placeholder="💼"
                    style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 16, textAlign: 'center', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Category Name</label>
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Work, Side Project, Personal"
                    style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                    required
                  />
                </div>
              </div>

              {/* Theme Color Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Theme Color</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                  {['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatColor(color)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: color,
                        border: newCatColor === color ? '3px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        transform: newCatColor === color ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesOpen(false)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--text-muted))', padding: '8px 16px', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', padding: '8px 24px', borderRadius: 'var(--border-radius-sm)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="glass-panel animate-slide-in" style={{ width: '100%', maxWidth: 700, borderRadius: 'var(--border-radius-lg)', padding: 32, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22 }}>Settings & Integrations</h2>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Configure your Telegram Bot and notifications</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Telegram Bot */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-teal))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>
                  🤖 Telegram Bot setup
                </h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                  1. Find <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: 'hsl(var(--accent-blue))', fontWeight: 600 }}>@BotFather</a> on Telegram.<br />
                  2. Create a new bot with <code>/newbot</code>, give it a name, and copy the <b>HTTP API Token</b>.<br />
                  3. Paste the Token below:
                </p>

                {/* Token Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Bot Token</label>
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                  />
                </div>

                {/* Chat ID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Authorized Chat ID</label>
                    <input
                      placeholder="e.g. 987654321"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Your Username (Optional)</label>
                    <input
                      placeholder="e.g. johndoe"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>

                <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.5, background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 'var(--border-radius-sm)' }}>
                  💡 <b>How to get your Chat ID:</b> First configure your Bot Token above and Save. Then search for your bot on Telegram, send it a message <code>/start</code>. The bot will automatically message you your Chat ID. Enter it here and Save again to restrict bot access to only you!
                </p>

                {config.telegramToken && config.authorizedChatId && (
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={testResult.status === 'loading'}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  >
                    {testResult.status === 'loading' ? 'Sending Test...' : '⚡ Test Connection (Send Telegram Ping)'}
                  </button>
                )}

                {testResult.message && (
                  <div style={{ fontSize: 12, padding: 10, borderRadius: 4, background: testResult.status === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: testResult.status === 'success' ? '#86efac' : '#fca5a5' }}>
                    {testResult.message}
                  </div>
                )}
              </section>

              {/* Webhook */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-blue))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>
                  ☁️ Vercel Webhook Deployment
                </h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                  If you deploy this app online to Vercel, Telegram must send updates to your app via Webhook. Enter your deployed URL below to link them:
                </p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="https://your-app.vercel.app/api/webhook"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    style={{ flex: 1, background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={suggestWebhookUrl}
                    style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'hsl(var(--accent-blue))', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0 12px', borderRadius: 'var(--border-radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Auto-Fill URL
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDeployWebhook(webhookUrlInput)}
                    disabled={!webhookUrlInput}
                    style={{ flex: 1, background: 'hsl(var(--accent-blue))', color: '#fff', border: 'none', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 700, cursor: webhookUrlInput ? 'pointer' : 'not-allowed', opacity: webhookUrlInput ? 1 : 0.5 }}
                  >
                    Deploy Webhook Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeployWebhook('')}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--text-muted))', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, cursor: 'pointer' }}
                  >
                    Disconnect Webhook (Use Polling)
                  </button>
                </div>
              </section>

              {/* Daily Digest */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-amber))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>
                  🌅 Daily Digest notification
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    id="digestEnabled"
                    checked={digestEnabledInput}
                    onChange={(e) => setDigestEnabledInput(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="digestEnabled" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Send scheduled task digests to my phone twice a day
                  </label>
                </div>

                {digestEnabledInput && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 30 }} className="animate-slide-in">
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Scheduled times (24h format, comma separated)</label>
                    <input
                      placeholder="e.g. 09:00, 20:00"
                      value={digestTimesInput}
                      onChange={(e) => setDigestTimesInput(e.target.value)}
                      style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-color))', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                )}
              </section>

              {/* Save changes button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
                {saveStatus.message && (
                  <div style={{ fontSize: 13, padding: 12, borderRadius: 6, background: saveStatus.status === 'success' ? 'rgba(74, 222, 128, 0.1)' : saveStatus.status === 'loading' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: saveStatus.status === 'success' ? '#86efac' : saveStatus.status === 'loading' ? '#93c5fd' : '#fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saveStatus.status === 'loading' && <div className="spinner"></div>}
                    {saveStatus.message}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--text-muted))', padding: '12px 24px', borderRadius: 'var(--border-radius-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={saveStatus.status === 'loading'}
                    style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', padding: '12px 32px', borderRadius: 'var(--border-radius-md)', fontSize: 14, fontWeight: 700, cursor: saveStatus.status === 'loading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { if (saveStatus.status !== 'loading') e.currentTarget.style.opacity = 0.9 }}
                    onMouseOut={(e) => { if (saveStatus.status !== 'loading') e.currentTarget.style.opacity = 1 }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
