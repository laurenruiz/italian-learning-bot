'use client'
import { Box, Stack, TextField, Button } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { createTheme } from '@mui/material/styles';
import { blue, indigo } from '@mui/material/colors';

export default function Home() {
  // Set MUI theme colors
  const theme = createTheme({
    palette: {
      primary: blue,
      secondary: indigo,
    },
  });

  // Initial message from the tutor
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the Italian Language AI Tutor! What would you like to review today?" }
  ]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true);

    // Create an updated conversation history including the new user message and a placeholder for the AI's response.
    const updatedMessages = [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' }
    ];
    // Immediately update state so the UI shows the new user message.
    setMessages(updatedMessages);
    setMessage('');

    try {
      // Trim the conversation history to include only the last 6 messages (adjust as needed)
      const trimmedMessages = updatedMessages.slice(-6);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmedMessages }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Read and stream the AI's response chunk-by-chunk
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { done: isDone, value } = await reader.read();
        done = isDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // Update the last message (assistant's placeholder) by appending the new chunk
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            return [
              ...prevMessages.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + chunk }
            ];
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'assistant', content: "I'm sorry, but I encountered an error. Please try again later." }
      ]);
    }
    setIsLoading(false);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // Scroll to the bottom whenever messages update
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Box width="100vw" height="100vh" display="flex" flexDirection="column" justifyContent="center" alignItems="center" bgcolor="white">
      <Stack direction="column" width="500px" height="700px" border="1px solid black" p={2} spacing={3}>
        <Stack direction="column" spacing={2} flexGrow={1} overflow="auto" maxHeight="100%">
          {messages.map((msg, index) => (
            <Box key={index} display="flex" justifyContent={msg.role === 'assistant' ? 'flex-start' : 'flex-end'}>
              <Box bgcolor={msg.role === 'assistant' ? 'primary.main' : 'secondary.main'} color="white" borderRadius={16} p={3}>
                {msg.content}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          <Button variant="contained" onClick={sendMessage} disabled={isLoading}>
            {isLoading ? 'Sending' : 'Send'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
