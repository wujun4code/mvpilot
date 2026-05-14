#!/usr/bin/env bash
# Forward new mvpilot leads to WeChat via WeChat Work IM bot API
set -euo pipefail

# === Configuration ===
LEADS_API_KEY="mvpilot-leads-key-2026"
LEADS_URL="https://mvpilot.aipromptor.com/api/admin/leads"
STATE_FILE="/tmp/mvpilot-leads-state"

# WeChat IM bot credentials (from openclaw-weixin plugin config)
WECHAT_BASE_URL="https://ilinkai.weixin.qq.com"
WECHAT_TOKEN="49c9cf564a49@im.bot:060000ff771c10ebe890ff8f69a2981aacd286"
WECHAT_TO="o9cq801o1iHi07nt6t_II2ZBdOuE@im.wechat"
WECHAT_CONTEXT_TOKEN="AARzJWAFAAABAAAAAABeDlPvqQkO4v82fsX7aSAAAAB+9905Q6UiugPBawU3n3cyzQX+LkN8ofRzsCZYN0mt7kQ+ePtcS4mPUM3YrIZlcSD9GfzeJyULYFvm252akqoWhhTvyjGD"

# === Get last seen timestamp ===
LAST_SEEN="$(cat "$STATE_FILE" 2>/dev/null || date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

# === Fetch new leads ===
LEADS=$(curl -sf "$LEADS_URL?key=$LEADS_API_KEY&since=$(echo -n "$LAST_SEEN" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip()))")" 2>/dev/null || echo "[]")
LEN=$(echo "$LEADS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")

if [ "$LEN" = "0" ]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
    exit 0
fi

echo "[$(date -Iseconds)] Found $LEN new lead(s)"

# === Forward each lead to WeChat ===
echo "$LEADS" | python3 -c "
import json, sys, os, urllib.request

leads = json.load(sys.stdin)
wechat_base = os.environ.get('WECHAT_BASE_URL', 'https://ilinkai.weixin.qq.com')
wechat_token = os.environ.get('WECHAT_TOKEN', '')
wechat_to = os.environ.get('WECHAT_TO', '')
wechat_context = os.environ.get('WECHAT_CONTEXT_TOKEN', '')
state_file = os.environ.get('STATE_FILE', '/tmp/mvpilot-leads-state')

latest = ''

for lead in leads:
    ts = lead.get('notifiedAt', '')
    if ts > latest: latest = ts
    
    plan = json.loads(lead.get('planJson') or 'null')
    
    # Build message text
    parts = ['🚀 新 MVPilot 线索\n']
    if plan:
        parts.append(f'💡 想法：{plan.get(\"problem\", \"?\")}')
        parts.append(f'👤 用户：{plan.get(\"user\", \"?\")}')
        parts.append('')
    
    if lead.get('contactEmail'):    parts.append(f'📧 Email：{lead[\"contactEmail\"]}')
    if lead.get('contactWechat'):   parts.append(f'💬 微信：{lead[\"contactWechat\"]}')
    if lead.get('contactTelegram'): parts.append(f'✈️ Telegram：{lead[\"contactTelegram\"]}')
    if lead.get('contactQq'):       parts.append(f'💬 QQ：{lead[\"contactQq\"]}')
    
    parts.append('')
    parts.append(f'🆔 {lead[\"id\"][:12]}')
    parts.append(f'🔗 https://mvpilot.aipromptor.com/chat/{lead[\"id\"]}')
    if lead.get('demoStatus') == 'ready':
        parts.append(f'🖥️ https://mvpilot.aipromptor.com/demo/{lead[\"id\"]}')
    
    text = chr(10).join(parts)
    
    # Build WeChat IM bot sendMessage request
    body = json.dumps({
        'msg': {
            'from_user_id': '',
            'to_user_id': wechat_to,
            'client_id': os.urandom(8).hex(),
            'message_type': 5,  # BOT
            'message_state': 3, # FINISH
            'item_list': [{
                'type': 1,  # TEXT
                'text_item': { 'text': text }
            }],
            'context_token': wechat_context or None,
        },
        'base_info': {
            'channel_version': '2.4.3',
            'bot_agent': 'mvpilot-forwarder/1.0',
        }
    })
    
    req = urllib.request.Request(
        f'{wechat_base}/ilink/bot/sendmessage',
        data=body.encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {wechat_token}',
            'AuthorizationType': 'ilink_bot_token',
            'iLink-App-Id': 'bot',
        },
        method='POST'
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        print(f'  ✓ Forwarded lead {lead[\"id\"][:12]}...')
    except Exception as e:
        body_text = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        print(f'  ✗ Failed: {body_text[:200]}')

# Update state
if latest:
    with open(state_file, 'w') as f:
        f.write(latest + chr(10))
else:
    import subprocess, datetime
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(state_file, 'w') as f:
        f.write(now + chr(10))
" 2>&1 || true

# Fallback: always update state to now
date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
