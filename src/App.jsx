import { useState, useEffect, useRef } from 'react';

const COLUMNS = [
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
  const [isInboxSidebarOpen, setIsInboxSidebarOpen] = useState(true); // Toggle left sidebar
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null); // category ID or null (All)

  // Task Input States
  const [addingToCol, setAddingToCol] = useState(null); // column id or null ('inbox', 'today', etc.)
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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to add task: ${errData.error || 'Server error'}`);
      }
    } catch (e) {
      console.error('Error adding task:', e);
      alert(`Network error adding task: ${e.message}`);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to save task: ${errData.error || 'Server error'}`);
      }
    } catch (e) {
      console.error('Error updating task text:', e);
      alert(`Network error saving task: ${e.message}`);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to create category: ${errData.error || 'Server error'}`);
      }
    } catch (e) {
      console.error('Error creating category:', e);
      alert(`Network error creating category: ${e.message}`);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category? Any tasks tagged with this category will become untagged.')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
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
        setSaveStatus({ status: 'success', message: 'Settings saved!' });
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
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      
      {/* 1. LEFT SIDEBAR: Inbox Column (Trello Split Layout) */}
      {isInboxSidebarOpen && (
        <aside
          style={{
            width: '320px',
            background: 'var(--bg-inbox)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 5,
            height: '100%',
          }}
        >
          {/* Inbox Header */}
          <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📥</span>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>Inbox</h2>
            </div>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', fontWeight: 700, color: 'var(--text-muted)' }}>
              {getTasksByCol('inbox').length}
            </span>
          </div>

          {/* Inbox Cards Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {/* see it send it tip card (from Trello screen) */}
            <div className="trello-card" style={{ borderRadius: 'var(--border-radius-md)', padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>✉️</span>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>See it, send it, save it</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Forward messages to your Telegram bot. They will land here instantly as cards.</p>
              </div>
            </div>

            {/* Inbox Card List */}
            {getTasksByCol('inbox').map((task) => {
              const category = categories.find((c) => c.id === task.categoryId);
              return (
                <div
                  key={task.id}
                  className="trello-card animate-slide-in"
                  onDoubleClick={() => startEditing(task)}
                  style={{
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '14px 16px',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  {editingTaskId === task.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                          outline: 'none',
                          resize: 'none',
                          minHeight: 40
                        }}
                      />
                      <select
                        value={editingTaskCategory}
                        onChange={(e) => setEditingTaskCategory(e.target.value)}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          padding: '4px 6px',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 11,
                          outline: 'none'
                        }}
                      >
                        <option value="">🏷️ Tag...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button onClick={cancelEditing} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => saveEditing(task.id)} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {category && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: `${category.color}15`, color: category.color, border: `1px solid ${category.color}25`, marginBottom: '8px' }}>
                          {category.emoji} {category.name}
                        </span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: '#f1f3f5' }}>{task.text}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {COLUMNS.map(c => (
                            <button key={c.id} onClick={() => handleMoveTask(task.id, c.id)} title={`Move to ${c.name}`} style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleMoveTask(task.id, 'done')} style={{ background: 'rgba(28, 196, 173, 0.08)', border: 'none', color: 'hsl(var(--accent-teal))', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                          <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'rgba(239, 68, 68, 0.08)', border: 'none', color: 'hsl(var(--accent-red))', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Inbox Card Adder */}
          <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            {addingToCol === 'inbox' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  placeholder="Type task details..."
                  value={newCardTexts.inbox}
                  onChange={(e) => setNewCardTexts({ ...newCardTexts, inbox: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask('inbox');
                    else if (e.key === 'Escape') setAddingToCol(null);
                  }}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 600, outline: 'none' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedAddCategory.inbox}
                    onChange={(e) => setSelectedAddCategory({ ...selectedAddCategory, inbox: e.target.value })}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 6px', borderRadius: 'var(--border-radius-sm)', fontSize: 11, outline: 'none', flex: 1 }}
                  >
                    <option value="">🏷️ Tag...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                    ))}
                  </select>
                  <button onClick={() => handleAddTask('inbox')} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', borderRadius: 'var(--border-radius-sm)', padding: '4px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Add</button>
                  <button onClick={() => setAddingToCol(null)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingToCol('inbox')}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '10px 0', borderRadius: 'var(--border-radius-sm)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span>+</span> Add a card
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 2. RIGHT PANEL: Focus Board Columns (Trello Sunset Gradient) */}
      <section
        style={{
          flex: 1,
          background: 'var(--bg-board-gradient)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Top Navbar */}
        <header
          style={{
            padding: '20px 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>My Trello Board</h2>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>▼</span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)', margin: '0 8px' }}></div>
            
            {/* Telegram connection status light */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 20, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: telegramStatus.tokenConfigured && telegramStatus.chatIdConfigured ? '#10b981' : '#f59e0b', display: 'inline-block' }}></span>
              <span>Telegram Bot: {telegramStatus.tokenConfigured && telegramStatus.chatIdConfigured ? 'Active' : 'Unpaired'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Category selection */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 20 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Filter:</span>
                <select
                  value={selectedCategoryFilter || ''}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value || null)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  <option value="" style={{ background: '#16181a' }}>🌐 All Tasks</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: '#16181a' }}>{cat.emoji} {cat.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={() => setIsManageCategoriesOpen(true)}
              title="Edit Categories"
              style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#fff', fontSize: 14, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              📁
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#fff', fontSize: 14, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Board Columns Grid */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            padding: '24px 40px 100px',
            display: 'flex',
            alignItems: 'start',
            gap: 20,
          }}
        >
          {COLUMNS.map((col) => {
            const colTasks = getTasksByCol(col.id);
            return (
              <div
                key={col.id}
                style={{
                  width: '282px',
                  background: 'var(--bg-column)',
                  borderRadius: 'var(--border-radius-lg)',
                  padding: '16px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 200px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0,
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f3f5' }}>{col.name}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {colTasks.length}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer' }}>•••</span>
                  </div>
                </div>

                {/* Cards Container */}
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40, paddingRight: 2 }}>
                  {colTasks.map((task) => {
                    const category = categories.find((c) => c.id === task.categoryId);
                    return (
                      <div
                        key={task.id}
                        className="trello-card animate-slide-in"
                        onDoubleClick={() => startEditing(task)}
                        style={{
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '12px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        {editingTaskId === task.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                color: '#fff',
                                borderRadius: 'var(--border-radius-sm)',
                                padding: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                outline: 'none',
                                resize: 'none',
                                minHeight: 40
                              }}
                            />
                            <select
                              value={editingTaskCategory}
                              onChange={(e) => setEditingTaskCategory(e.target.value)}
                              style={{
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                color: '#fff',
                                padding: '4px 6px',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: 11,
                                outline: 'none'
                              }}
                            >
                              <option value="">🏷️ Tag...</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                              ))}
                            </select>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button onClick={cancelEditing} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                              <button onClick={() => saveEditing(task.id)} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {category && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: `${category.color}15`, color: category.color, border: `1px solid ${category.color}25`, marginBottom: '8px' }}>
                                {category.emoji} {category.name}
                              </span>
                            )}
                            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: '#f1f3f5' }}>{task.text}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handleMoveTask(task.id, 'inbox')} title="Move to Inbox" style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📥</button>
                                {COLUMNS.filter(c => c.id !== col.id).map(c => (
                                  <button key={c.id} onClick={() => handleMoveTask(task.id, c.id)} title={`Move to ${c.name}`} style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</button>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handleMoveTask(task.id, 'done')} style={{ background: 'rgba(28, 196, 173, 0.08)', border: 'none', color: 'hsl(var(--accent-teal))', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                                <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'rgba(239, 68, 68, 0.08)', border: 'none', color: 'hsl(var(--accent-red))', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div style={{ padding: '24px 0', border: '1px dashed rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                      No tasks
                    </div>
                  )}
                </div>

                {/* Add Card Control */}
                {addingToCol === col.id ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      placeholder="Type task details..."
                      value={newCardTexts[col.id]}
                      onChange={(e) => setNewCardTexts({ ...newCardTexts, [col.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask(col.id);
                        else if (e.key === 'Escape') setAddingToCol(null);
                      }}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 600, outline: 'none' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={selectedAddCategory[col.id] || ''}
                        onChange={(e) => setSelectedAddCategory({ ...selectedAddCategory, [col.id]: e.target.value })}
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 6px', borderRadius: 'var(--border-radius-sm)', fontSize: 11, outline: 'none', flex: 1 }}
                      >
                        <option value="">🏷️ Tag...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                        ))}
                      </select>
                      <button onClick={() => handleAddTask(col.id)} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', borderRadius: 4, padding: '4px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Add</button>
                      <button onClick={() => setAddingToCol(null)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToCol(col.id)}
                    style={{
                      marginTop: 10,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      padding: '8px 4px',
                      borderRadius: 'var(--border-radius-sm)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 6,
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#fff' }}
                    onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <span>+</span> Add a card
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 3. CENTERED FLOATING BOTTOM NAVIGATION BAR (Trello Mobile Style) */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10, 17, 32, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
            borderRadius: 30,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setIsInboxSidebarOpen(!isInboxSidebarOpen)}
            style={{
              background: isInboxSidebarOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: isInboxSidebarOpen ? '#fff' : 'var(--text-muted)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span>📥</span> Inbox
          </button>
          
          <button
            onClick={() => {
              setActiveTab(activeTab === 'board' ? 'completed' : 'board');
            }}
            style={{
              background: activeTab === 'completed' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === 'completed' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span>{activeTab === 'completed' ? '📋 Board' : '✅ Completed'}</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#fff' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <span>⚙️</span> Settings
          </button>
        </div>
      </section>

      {/* Completed History List overlay */}
      {activeTab === 'completed' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 20 }}>
          <div className="glass-panel animate-slide-in" style={{ width: '100%', maxWidth: 700, borderRadius: 'var(--border-radius-lg)', padding: 32, maxHeight: '80vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20 }}>Completed Tasks Log</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>History of tasks completed successfully</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
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
                <button
                  onClick={() => setActiveTab('board')}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', fontSize: 13 }}
                >
                  Close Log
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {completedTasks.map((task) => {
                const category = categories.find((c) => c.id === task.categoryId);
                return (
                  <div key={task.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 'var(--border-radius-md)', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {category && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: `${category.color}12`, color: category.color, border: `1px solid ${category.color}25` }}>
                            {category.emoji} {category.name}
                          </span>
                        )}
                        <div style={{ fontSize: 15, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{task.text}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>✓ Completed on {new Date(task.completedAt || task.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleMoveTask(task.id, 'inbox')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 'var(--border-radius-sm)', fontSize: 12, cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#fff'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>Restore</button>
                      <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'hsl(var(--accent-red))', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                    </div>
                  </div>
                );
              })}
              {completedTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
                  <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📈</span>
                  No completed tasks yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Categories Modal */}
      {isManageCategoriesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div className="glass-panel animate-slide-in" style={{ width: '100%', maxWidth: 550, borderRadius: 'var(--border-radius-lg)', padding: 32, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20 }}>Manage Categories</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create and organize tags for your tasks</p>
              </div>
              <button onClick={() => setIsManageCategoriesOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
              {categories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }}></span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--accent-red))', border: 'none', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                </div>
              ))}
              {categories.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-dim)', fontSize: 13 }}>No categories created yet.</div>
              )}
            </div>

            <form onSubmit={handleAddCategory} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>Create New Category</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Emoji</label>
                  <input value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} placeholder="💼" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 16, textAlign: 'center', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Category Name</label>
                  <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Work, Side Project, Personal" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Theme Color</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                  {['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#06b6d4'].map((color) => (
                    <button key={color} type="button" onClick={() => setNewCatColor(color)} style={{ width: 28, height: 28, borderRadius: '50%', background: color, border: newCatColor === color ? '3px solid #fff' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transform: newCatColor === color ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s' }} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setIsManageCategoriesOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="submit" style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', padding: '8px 24px', borderRadius: 'var(--border-radius-sm)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="glass-panel animate-slide-in" style={{ width: '100%', maxWidth: 700, borderRadius: 'var(--border-radius-lg)', padding: 32, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22 }}>Settings & Integrations</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Configure your Telegram Bot and notifications</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 4 }}>×</button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-teal))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>🤖 Telegram Bot setup</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  1. Find <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: 'hsl(var(--accent-blue))', fontWeight: 600 }}>@BotFather</a> on Telegram.<br />
                  2. Create a new bot with <code>/newbot</code>, give it a name, and copy the <b>HTTP API Token</b>.<br />
                  3. Paste the Token below:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Bot Token</label>
                  <input type="password" placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Authorized Chat ID</label>
                    <input placeholder="e.g. 987654321" value={chatIdInput} onChange={(e) => setChatIdInput(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Your Username (Optional)</label>
                    <input placeholder="e.g. johndoe" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} />
                  </div>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 'var(--border-radius-sm)' }}>
                  💡 <b>How to get your Chat ID:</b> First configure your Bot Token above and Save. Then search for your bot on Telegram, send it a message <code>/start</code>. The bot will automatically message you your Chat ID. Enter it here and Save again to restrict bot access to only you!
                </p>

                {config.telegramToken && config.authorizedChatId && (
                  <button type="button" onClick={handleTestTelegram} disabled={testResult.status === 'loading'} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                    {testResult.status === 'loading' ? 'Sending Test...' : '⚡ Test Connection (Send Telegram Ping)'}
                  </button>
                )}

                {testResult.message && (
                  <div style={{ fontSize: 12, padding: 10, borderRadius: 4, background: testResult.status === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: testResult.status === 'success' ? '#86efac' : '#fca5a5' }}>{testResult.message}</div>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-blue))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>☁️ Vercel Webhook Deployment</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>If you deploy this app online to Vercel, Telegram must send updates to your app via Webhook. Enter your deployed URL below to link them:</p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="https://your-app.vercel.app/api/webhook" value={webhookUrlInput} onChange={(e) => setWebhookUrlInput(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} />
                  <button type="button" onClick={suggestWebhookUrl} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'hsl(var(--accent-blue))', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0 12px', borderRadius: 'var(--border-radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Auto-Fill URL</button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => handleDeployWebhook(webhookUrlInput)} disabled={!webhookUrlInput} style={{ flex: 1, background: 'hsl(var(--accent-blue))', color: '#fff', border: 'none', padding: '10px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, fontWeight: 700, cursor: webhookUrlInput ? 'pointer' : 'not-allowed', opacity: webhookUrlInput ? 1 : 0.5 }}>Deploy Webhook Link</button>
                  <button type="button" onClick={() => handleDeployWebhook('')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 13, cursor: 'pointer' }}>Disconnect Webhook (Use Polling)</button>
                </div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 15, color: 'hsl(var(--accent-amber))', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>🌅 Daily Digest notification</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="checkbox" id="digestEnabled" checked={digestEnabledInput} onChange={(e) => setDigestEnabledInput(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <label htmlFor="digestEnabled" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Send scheduled task digests to my phone twice a day</label>
                </div>

                {digestEnabledInput && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 30 }} className="animate-slide-in">
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Scheduled times (24h format, comma separated)</label>
                    <input placeholder="e.g. 09:00, 20:00" value={digestTimesInput} onChange={(e) => setDigestTimesInput(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: 14, outline: 'none' }} />
                  </div>
                )}
              </section>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
                {saveStatus.message && (
                  <div style={{ fontSize: 13, padding: 12, borderRadius: 6, background: saveStatus.status === 'success' ? 'rgba(74, 222, 128, 0.1)' : saveStatus.status === 'loading' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: saveStatus.status === 'success' ? '#86efac' : saveStatus.status === 'loading' ? '#93c5fd' : '#fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saveStatus.status === 'loading' && <div className="spinner"></div>}
                    {saveStatus.message}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" onClick={() => setIsSettingsOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '12px 24px', borderRadius: 'var(--border-radius-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                  <button type="submit" disabled={saveStatus.status === 'loading'} style={{ background: 'hsl(var(--accent-teal))', color: '#000', border: 'none', padding: '12px 32px', borderRadius: 'var(--border-radius-md)', fontSize: 14, fontWeight: 700, cursor: saveStatus.status === 'loading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { if (saveStatus.status !== 'loading') e.currentTarget.style.opacity = 0.9 }} onMouseOut={(e) => { if (saveStatus.status !== 'loading') e.currentTarget.style.opacity = 1 }}>Save Changes</button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
