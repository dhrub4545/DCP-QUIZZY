import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Send, Bot, User, Sparkles, Lightbulb, HelpCircle, Brain, Image as ImageIcon, Camera, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { sendAiChatApi } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

export default function AiChatModal({ visible, questionContext, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (visible && questionContext) {
      // Welcome initial message from AI Tutor
      setMessages([
        {
          id: 'welcome_1',
          sender: 'ai',
          text: `Hello! 👋 I'm your **Gemini 3.6 Flash AI Tutor**. I've loaded this question into my memory:\n\n**Question**: "${questionContext.questionText?.slice(0, 100)}..."\n\nHow can I help you understand this concept better? You can attach photos/diagrams using the 📷 icon, choose a quick action chip below, or type your question!`,
        },
      ]);
      setInputText('');
      setSelectedImage(null);
    }
  }, [visible, questionContext]);

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant photo library access to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
        setSelectedImage({
          uri: asset.uri,
          base64: base64Data,
        });
      }
    } catch (err) {
      console.error('Error picking image:', err);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant camera access to capture a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
        setSelectedImage({
          uri: asset.uri,
          base64: base64Data,
        });
      }
    } catch (err) {
      console.error('Error capturing camera photo:', err);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const messageText = textToSend || inputText;
    const imageToAttach = selectedImage;

    if ((!messageText || !messageText.trim()) && !imageToAttach) return;
    if (loading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: messageText ? messageText.trim() : (imageToAttach ? '📷 Attached Photo for analysis' : ''),
      imageUri: imageToAttach?.uri || null,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const response = await sendAiChatApi({
        questionContext,
        chatHistory: updatedMessages.map((m) => ({ sender: m.sender, text: m.text })),
        userMessage: messageText ? messageText.trim() : 'Please analyze this attached photo/diagram in detail.',
        imageBase64: imageToAttach?.base64 || null,
      });

      if (response && response.reply) {
        const aiMsg = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: response.reply,
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      console.error('AI Tutor Error:', err);
      const errorMsg = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `⚠️ **AI Tutor Notice**: ${err.response?.data?.message || err.message || 'Failed to reach AI service. Please try again!'}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: '💡 Why is answer right?', text: `Explain why Option ${questionContext?.correctAnswerLetter || 'A'} is the correct answer in detail.` },
    { label: '❌ Why are others wrong?', text: 'Explain step-by-step why the other distractor options are incorrect.' },
    { label: '🧠 Give me a mnemonic', text: 'Provide a clever memory mnemonic to help me remember this concept easily.' },
    { label: '👶 Explain simply', text: 'Explain this concept in simple terms like I am 10 years old.' },
  ];

  if (!visible || !questionContext) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.botIconBadge}>
                <Bot size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={styles.aiTagRow}>
                  <Text style={styles.headerTitle}>AI Tutor Chat</Text>
                  <View style={styles.modelBadge}>
                    <Sparkles size={9} color="#a855f7" />
                    <Text style={styles.modelBadgeText}>Gemini 3.6 Flash</Text>
                  </View>
                </View>
                <Text style={styles.headerSub} numberOfLines={1}>
                  Context: {questionContext.questionText}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Chat Thread */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.threadContainer}
            contentContainerStyle={styles.threadContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  msg.sender === 'user' ? styles.userRow : styles.aiRow,
                ]}
              >
                {msg.sender === 'ai' && (
                  <View style={styles.aiAvatar}>
                    <Bot size={13} color="#818cf8" />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {msg.imageUri && (
                    <Image source={{ uri: msg.imageUri }} style={styles.bubbleAttachedImage} resizeMode="cover" />
                  )}
                  {msg.sender === 'user' ? (
                    <Text style={styles.userText}>{msg.text}</Text>
                  ) : (
                    <MarkdownRenderer content={msg.text} />
                  )}
                </View>
              </View>
            ))}

            {loading && (
              <View style={styles.loadingRow}>
                <View style={styles.aiAvatar}>
                  <Bot size={13} color="#818cf8" />
                </View>
                <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#818cf8" />
                  <Text style={styles.typingText}>Gemini 3.6 Flash is analyzing...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Attached Image Preview Bar */}
          {selectedImage && (
            <View style={styles.attachmentPreviewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.attachmentThumbnail} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.attachmentTitle}>Photo attached for Gemini 3.6</Text>
                <Text style={styles.attachmentSub}>Ready to send with your query</Text>
              </View>
              <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => setSelectedImage(null)}>
                <X size={14} color="#f87171" />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Action Prompts */}
          <View style={styles.quickPromptsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
              {quickPrompts.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickPromptChip}
                  onPress={() => handleSendMessage(item.text)}
                  disabled={loading}
                >
                  <Text style={styles.quickPromptText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachIconBtn} onPress={handlePickImage} disabled={loading}>
              <ImageIcon size={18} color="#818cf8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachIconBtn} onPress={handleCameraCapture} disabled={loading}>
              <Camera size={18} color="#818cf8" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Ask or attach a photo to AI Tutor..."
              placeholderTextColor="#64748b"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, ((!inputText.trim() && !selectedImage) || loading) && styles.sendBtnDisabled]}
              onPress={() => handleSendMessage()}
              disabled={(!inputText.trim() && !selectedImage) || loading}
            >
              <Send size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  botIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c084fc',
    marginLeft: 3,
  },
  headerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  threadContainer: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#312e81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginTop: 4,
  },
  bubble: {
    padding: 10,
    borderRadius: 12,
  },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  userText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '600',
  },
  quickPromptsBar: {
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  quickPromptChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  quickPromptText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#f8fafc',
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  attachIconBtn: {
    padding: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleAttachedImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  attachmentThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  attachmentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  attachmentSub: {
    fontSize: 11,
    color: '#818cf8',
    marginTop: 1,
  },
  removeAttachmentBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
});
