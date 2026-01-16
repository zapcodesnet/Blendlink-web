/**
 * Admin AI Assistant Screen for Blendlink Mobile
 * AI-powered admin tools and insights
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminAIScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your AI Admin Assistant. I can help you with user analytics, content moderation, and platform insights. What would you like to know?' }
  ]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleSend = () => {
    if (!query.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setQuery('');
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I\'m processing your request. This AI assistant is synced with the web admin panel and can provide real-time insights about your platform.' 
      }]);
    }, 1000);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading AI Assistant...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🤖 AI Assistant</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>📊 User Growth</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>💰 Revenue Trends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>🚨 Risk Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>📈 Engagement</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Chat */}
        <View style={styles.chatContainer}>
          {messages.map((msg, idx) => (
            <View 
              key={idx} 
              style={[
                styles.messageRow,
                msg.role === 'user' && styles.messageRowUser
              ]}
            >
              <View style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble
              ]}>
                <Text style={styles.messageText}>{msg.content}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor="#64748B"
          value={query}
          onChangeText={setQuery}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#3B82F6', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  quickActions: { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  quickBtn: { backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  quickBtnText: { color: '#fff', fontSize: 13 },
  chatContainer: { flex: 1, marginBottom: 20 },
  messageRow: { marginBottom: 12 },
  messageRowUser: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 16 },
  assistantBubble: { backgroundColor: '#1E293B', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#1E293B', gap: 12 },
  input: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 12, color: '#fff', maxHeight: 100 },
  sendButton: { backgroundColor: '#3B82F6', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
