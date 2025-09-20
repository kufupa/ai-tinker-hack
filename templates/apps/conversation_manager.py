# Flask backend integration for ElevenLabs and MCP
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import asyncio
import websockets
import json
import base64
import os
from elevenlabs.conversational_ai import ConversationalAI
from elevenlabs.client import ElevenLabs
import threading
import uuid

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
active_conversations = {}

class ConversationManager:
    def __init__(self, agent_id, conversation_id):
        self.agent_id = agent_id
        self.conversation_id = conversation_id
        self.websocket = None
        self.is_active = False
    
    async def start_conversation(self):
        try:
            ws_url = f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={self.agent_id}"
            headers = {
                "Authorization": f"Bearer {os.getenv('ELEVENLABS_API_KEY')}"
            }
            self.websocket = await websockets.connect(ws_url, extra_headers=headers)
            self.is_active = True
            await self.websocket.send(json.dumps({
                "type": "conversation_initiation_client_data",
                "conversation_id": self.conversation_id
            }))
            return True
        except Exception as e:
            print(f"Failed to start conversation: {e}")
            return False
    async def send_audio(self, audio_data):
        if self.websocket and self.is_active:
            message = {
                "type": "audio",
                "audio": base64.b64encode(audio_data).decode('utf-8')
            }
            await self.websocket.send(json.dumps(message))
    async def listen_for_responses(self, callback):
        try:
            async for message in self.websocket:
                data = json.loads(message)
                await callback(data)
        except Exception as e:
            print(f"WebSocket error: {e}")
            self.is_active = False

@app.route('/start-conversation', methods=['POST'])
def start_conversation():
    data = request.get_json()
    agent_id = data.get('agent_id')
    if not agent_id:
        return jsonify({'error': 'Agent ID is required'}), 400
    conversation_id = str(uuid.uuid4())
    try:
        conversation = ConversationManager(agent_id, conversation_id)
        active_conversations[conversation_id] = conversation
        def start_async_conversation():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            success = loop.run_until_complete(conversation.start_conversation())
            if success:
                loop.run_until_complete(
                    conversation.listen_for_responses(handle_agent_response)
                )
        thread = threading.Thread(target=start_async_conversation)
        thread.daemon = True
        thread.start()
        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'agent_id': agent_id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

async def handle_agent_response(data):
    print(f"Agent response: {data}")

@app.route('/send-audio', methods=['POST'])
def send_audio():
    conversation_id = request.form.get('conversation_id')
    audio_file = request.files.get('audio')
    if not conversation_id or not audio_file:
        return jsonify({'error': 'Conversation ID and audio file required'}), 400
    conversation = active_conversations.get(conversation_id)
    if not conversation:
        return jsonify({'error': 'Conversation not found'}), 404
    try:
        audio_data = audio_file.read()
        def send_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(conversation.send_audio(audio_data))
        thread = threading.Thread(target=send_async)
        thread.daemon = True
        thread.start()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/end-conversation', methods=['POST'])
def end_conversation():
    data = request.get_json()
    conversation_id = data.get('conversation_id')
    conversation = active_conversations.get(conversation_id)
    if conversation:
        conversation.is_active = False
        if conversation.websocket:
            asyncio.run(conversation.websocket.close())
        del active_conversations[conversation_id]
    return jsonify({'success': True})

@app.route('/get-agent-info/<agent_id>', methods=['GET'])
def get_agent_info(agent_id):
    try:
        return jsonify({
            'agent_id': agent_id,
            'name': 'Your Agent Name',
            'has_mcp_server': True,
            'mcp_servers': ['Dedalus Anthropic Search MCP']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
