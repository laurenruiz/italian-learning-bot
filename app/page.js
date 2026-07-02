'use client'
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { createTheme } from '@mui/material/styles';
import { blue, blueGrey } from '@mui/material/colors';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ReactMarkdown from 'react-markdown';

const LEARNABLE_LANGUAGES = [
  { name: 'Italian',    code: 'it' },
  { name: 'Spanish',    code: 'es' },
  { name: 'French',     code: 'fr' },
  { name: 'German',     code: 'de' },
  { name: 'Portuguese', code: 'br' },
  { name: 'Japanese',   code: 'jp' },
  { name: 'Korean',     code: 'kr' },
  { name: 'Mandarin',   code: 'cn' },
  { name: 'Russian',    code: 'ru' },
  { name: 'Arabic',     code: 'sa' },
  { name: 'Hindi',      code: 'in' },
  { name: 'Dutch',      code: 'nl' },
];

function FlagImg({ code, size = 20 }) {
  return (
    <img
      src={`https://flagcdn.com/${size}x${Math.round(size * 0.75)}/${code}.png`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
    />
  );
}

const UI_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian',
  'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Russian',
  'Arabic', 'Hindi',
];

function getIntroMessage(uiLang, targetLang) {
  const messages = {
    English:    `Hi! I'm your ${targetLang} Language AI Tutor! What would you like to review today?`,
    Spanish:    `¡Hola! Soy tu tutor de IA de idiomas. ¿Qué te gustaría repasar hoy?`,
    French:     `Bonjour ! Je suis votre tuteur d'IA en langues. Que souhaiteriez-vous revoir aujourd'hui ?`,
    German:     `Hallo! Ich bin Ihr KI-Sprachtutor. Was möchten Sie heute üben?`,
    Italian:    `Ciao! Sono il tuo tutor di lingue con intelligenza artificiale. Cosa vorresti ripassare oggi?`,
    Portuguese: `Olá! Sou o seu tutor de idiomas por IA. O que você gostaria de revisar hoje?`,
    Chinese:    `你好！我是您的语言AI辅导员。今天你想复习什么？`,
    Japanese:   `こんにちは！私はあなたの言語AIチューターです。今日は何を復習しますか？`,
    Korean:     `안녕하세요! 저는 당신의 언어 AI 튜터입니다. 오늘 무엇을 복습하고 싶으신가요?`,
    Russian:    `Привет! Я ваш AI-репетитор по языкам. Что вы хотели бы повторить сегодня?`,
    Arabic:     `مرحباً! أنا مدرس الذكاء الاصطناعي للغات. ماذا تريد أن تراجع اليوم؟`,
    Hindi:      `नमस्ते! मैं आपका भाषा AI ट्यूटर हूं। आज आप क्या दोहराना चाहेंगे?`,
  };
  return messages[uiLang] ?? messages.English;
}

export default function Home() {
  const theme = createTheme({
    palette: { primary: blue, secondary: blueGrey },
  });

  const { user, isLoaded } = useUser();

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uiLanguage, setUiLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [feedback, setFeedback] = useState({});
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load saved target language from Clerk metadata — only on initial load
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    const saved = user.unsafeMetadata?.targetLanguage;
    if (saved) {
      setTargetLanguage(saved);
    } else {
      setShowLanguagePicker(true);
    }
  }, [isLoaded]); // intentionally excludes `user` to prevent re-running after user.update()

  // Reset chat when UI language or target language changes
  useEffect(() => {
    if (!targetLanguage) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setFeedback({});
    setMessages([{ role: 'assistant', content: getIntroMessage(uiLanguage, targetLanguage) }]);
  }, [uiLanguage, targetLanguage]);

  const selectTargetLanguage = async (lang) => {
    setTargetLanguage(lang);
    setShowLanguagePicker(false);
    await user.update({
      unsafeMetadata: { ...user.unsafeMetadata, targetLanguage: lang },
    });
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true);

    const updatedMessages = [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ];
    setMessages(updatedMessages);
    setMessage('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const trimmedMessages = updatedMessages.slice(-6);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmedMessages, language: uiLanguage, targetLanguage }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { done: isDone, value } = await reader.read();
        done = isDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            return [
              ...prevMessages.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + chunk },
            ];
          });
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error:', error);
        setMessages(prevMessages => [
          ...prevMessages,
          { role: 'assistant', content: "I'm sorry, but I encountered an error. Please try again later." },
        ]);
      }
    }
    setIsLoading(false);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const submitFeedback = async (index, rating, content) => {
    setFeedback(prev => ({ ...prev, [index]: rating }));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageContent: content, rating, timestamp: new Date().toISOString() }),
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setUploadMessage('Please upload a PDF file.');
      return;
    }

    setUploadStatus('uploading');
    setUploadMessage(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadStatus('success');
      setUploadMessage(`${file.name} uploaded (${data.chunksUploaded} chunks)`);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('error');
      setUploadMessage(err.message);
    }

    event.target.value = '';
    setTimeout(() => setUploadStatus(null), 5000);
  };

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentLangInfo = LEARNABLE_LANGUAGES.find(l => l.name === targetLanguage);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Show when="signed-out">
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5">Language AI Tutor</Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to start learning and upload your own notes.
          </Typography>
          <SignInButton mode="modal">
            <Button variant="contained">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button variant="outlined">Sign up</Button>
          </SignUpButton>
        </Stack>
      </Show>

      <Show when="signed-in">
        {/* Language picker modal */}
        <Dialog
          open={showLanguagePicker}
          maxWidth="sm"
          fullWidth
          disableEscapeKeyDown={!targetLanguage}
          onClose={targetLanguage ? () => setShowLanguagePicker(false) : undefined}
        >
          <DialogTitle>What language do you want to learn?</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.5 }}>
              {LEARNABLE_LANGUAGES.map((lang) => (
                <Button
                  key={lang.name}
                  variant={targetLanguage === lang.name ? 'contained' : 'outlined'}
                  onClick={() => selectTargetLanguage(lang.name)}
                  sx={{ width: 'calc(33.33% - 8px)', py: 1.5, fontSize: '0.95rem' }}
                >
                  <FlagImg code={lang.code} />
                  {lang.name}
                </Button>
              ))}
            </Box>
            {targetLanguage && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={() => setShowLanguagePicker(false)}>Cancel</Button>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Chat UI */}
        {!isLoaded ? (
          <CircularProgress />
        ) : targetLanguage ? (
          <Stack
            direction="column"
            sx={{
              width: { xs: '90%', sm: '500px' },
              maxWidth: '500px',
              minWidth: 0,
              height: '700px',
              border: '1px solid black',
              backgroundColor: 'white',
              p: 2,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Tooltip title="Change language">
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowLanguagePicker(true)}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                  {currentLangInfo && <FlagImg code={currentLangInfo.code} />}
                  {targetLanguage}
                </Button>
              </Tooltip>
              <UserButton />
            </Stack>

            {/* Messages */}
            <Stack
              direction="column"
              spacing={2}
              sx={{
                flexGrow: 1,
                width: '100%',
                minWidth: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {messages.map((msg, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'assistant' ? 'flex-start' : 'flex-end',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: msg.role === 'assistant' ? 'primary.main' : 'secondary.main',
                      color: 'white',
                      borderRadius: 2,
                      p: 3,
                      maxWidth: '80%',
                      minWidth: 0,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </Box>
                  {msg.role === 'assistant' && msg.content && !isLoading && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, ml: 0.5 }}>
                      <Tooltip title="Helpful">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => submitFeedback(index, 'up', msg.content)}
                            disabled={feedback[index] != null}
                            sx={{
                              opacity: feedback[index] === 'up' ? 1 : feedback[index] === 'down' ? 0.3 : 1,
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <ThumbUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Not helpful">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => submitFeedback(index, 'down', msg.content)}
                            disabled={feedback[index] != null}
                            sx={{
                              opacity: feedback[index] === 'down' ? 1 : feedback[index] === 'up' ? 0.3 : 1,
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <ThumbDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  )}
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Stack>

            {uploadStatus && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                {uploadStatus === 'uploading' && <CircularProgress size={14} />}
                <Typography
                  variant="caption"
                  color={uploadStatus === 'error' ? 'error' : uploadStatus === 'success' ? 'success.main' : 'text.secondary'}
                >
                  {uploadMessage}
                </Typography>
              </Stack>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Upload PDF notes:
                </Typography>
                <Tooltip title="Upload PDF notes to train the tutor">
                  <span>
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadStatus === 'uploading'}
                      size="small"
                    >
                      <UploadFileIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Your Language</InputLabel>
                <Select
                  value={uiLanguage}
                  label="Your Language"
                  onChange={(e) => setUiLanguage(e.target.value)}
                >
                  {UI_LANGUAGES.map((lang) => (
                    <MenuItem key={lang} value={lang}>{lang}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ width: '100%', minWidth: 0, mt: 1 }}>
              <TextField
                label="Message"
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
              />
              <Button variant="contained" onClick={sendMessage} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Show>
    </Box>
  );
}
