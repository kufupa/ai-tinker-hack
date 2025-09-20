import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const ConversationManager = () => {
    const [conversationId, setConversationId] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [agentId] = useState('your-agent-id-here');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const startConversation = async () => {
        try {
            const response = await axios.post('http://localhost:5000/start-conversation', {
                agent_id: agentId
            });
            if (response.data.success) {
                setConversationId(response.data.conversation_id);
                setIsConnected(true);
                console.log('Conversation started:', response.data.conversation_id);
            }
        } catch (error) {
            console.error('Failed to start conversation:', error);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                sendAudioToAgent(audioBlob);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            const tracks = mediaRecorderRef.current.stream.getTracks();
            tracks.forEach(track => track.stop());
        }
    };

    const sendAudioToAgent = async (audioBlob) => {
        if (!conversationId) return;
        const formData = new FormData();
        formData.append('conversation_id', conversationId);
        formData.append('audio', audioBlob, 'audio.wav');
        try {
            const response = await axios.post('http://localhost:5000/send-audio', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            console.log('Audio sent successfully:', response.data);
        } catch (error) {
            console.error('Failed to send audio:', error);
        }
    };

    const endConversation = async () => {
        if (!conversationId) return;
        try {
            await axios.post('http://localhost:5000/end-conversation', {
                conversation_id: conversationId
            });
            setConversationId(null);
            setIsConnected(false);
            console.log('Conversation ended');
        } catch (error) {
            console.error('Failed to end conversation:', error);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
            <h2>ElevenLabs AI Agent with MCP Integration</h2>
            {!isConnected ? (
                <button 
                    onClick={startConversation}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Start Conversation
                </button>
            ) : (
                <div>
                    <p>Conversation Active (ID: {conversationId?.substring(0, 8)}...)</p>
                    <div style={{ margin: '20px 0' }}>
                        {!isRecording ? (
                            <button 
                                onClick={startRecording}
                                style={{
                                    padding: '12px 24px',
                                    fontSize: '16px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '10px'
                                }}
                            >
                                🎤 Start Recording
                            </button>
                        ) : (
                            <button 
                                onClick={stopRecording}
                                style={{
                                    padding: '12px 24px',
                                    fontSize: '16px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '10px'
                                }}
                            >
                                🛑 Stop Recording
                            </button>
                        )}
                        <button 
                            onClick={endConversation}
                            style={{
                                padding: '12px 24px',
                                fontSize: '16px',
                                backgroundColor: '#9E9E9E',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            End Conversation
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationManager;
