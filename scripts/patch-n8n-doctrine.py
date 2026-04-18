#!/usr/bin/env python
"""
Surgical patch of the ig-setter-pro n8n workflow to delegate AI reply
generation to the PULSE doctrine layer (/api/webhook now runs classify
+ respond internally).

Changes:
  1. Remove 4 nodes: Fetch Conversation History, Build Claude Context,
     Claude — Generate Reply (with History), Claude — Classify Lead Status
  2. Rewire DM path: Merge Profile → Build Payload (skip removed nodes)
  3. Rewrite Build Payload: strip pending_ai_draft / ai_reply; doctrine
     generates draft server-side.
  4. Update Auto-Send Enabled? to also require doctrine.should_send
  5. Update Auto-Send IG Reply to use doctrine.draft from the /api/webhook
     response instead of the n8n-generated ai_reply.

Usage:
  python scripts/patch-n8n-doctrine.py <input.json> <output.json>
"""

import json, sys, copy

REMOVE = {
    "Fetch Conversation History",
    "Build Claude Context",
    "Claude \u2014 Generate Reply (with History)",
    "Claude \u2014 Classify Lead Status",
}

NEW_BUILD_PAYLOAD_CODE = """
// Doctrine now generates the reply server-side. This payload just carries
// the clean inbound to /api/webhook — the webhook's runDoctrine() adds
// the draft via classify+respond and returns it in response.doctrine.draft.
const dm = $('Merge Profile').first().json;

return [{
  json: {
    account_id: dm.account_id || '920e39ca65a72bb0b56a5db0ba89d8cf',
    ig_thread_id: dm.ig_thread_id,
    ig_user_id: dm.ig_user_id,
    ig_message_id: dm.ig_message_id,
    username: dm.username,
    display_name: dm.display_name,
    message: dm.message_text,
    direction: 'inbound',
    status: 'active',
    ai_status: 'active',
    pending_ai_draft: null,   // let doctrine generate
    is_ai: false
  }
}];
"""

# Auto-Send Enabled? now reads doctrine.should_send alongside auto_send_enabled
NEW_AUTO_SEND_LEFT = "={{ ($('POST to Dashboard').first().json.auto_send_enabled && $('POST to Dashboard').first().json.doctrine && $('POST to Dashboard').first().json.doctrine.should_send && $('POST to Dashboard').first().json.doctrine.draft) ? 'true' : 'false' }}"

# Auto-Send IG Reply now uses doctrine.draft from the POST response
NEW_AUTO_SEND_BODY = """={
  "recipient": { "id": "{{ $(\\"Build Payload\\").first().json.ig_user_id }}" },
  "message":   { "text": {{ JSON.stringify($('POST to Dashboard').first().json.doctrine.draft) }} }
}"""


def patch(wf: dict) -> dict:
    wf = copy.deepcopy(wf)

    # 1. Remove dead nodes
    wf["nodes"] = [n for n in wf["nodes"] if n["name"] not in REMOVE]

    # 2. Patch Build Payload
    for n in wf["nodes"]:
        if n["name"] == "Build Payload":
            n["parameters"]["jsCode"] = NEW_BUILD_PAYLOAD_CODE
        elif n["name"] == "Auto-Send Enabled?":
            cond = n["parameters"]["conditions"]["conditions"][0]
            cond["leftValue"] = NEW_AUTO_SEND_LEFT
            cond["rightValue"] = "true"
        elif n["name"] == "Auto-Send IG Reply":
            n["parameters"]["jsonBody"] = NEW_AUTO_SEND_BODY

    # 3. Rewire connections — for each removed node, reroute its upstream's
    #    output to its downstream's target, then dedupe edges that point to
    #    the same node (can happen when multiple dead nodes all fed the same
    #    downstream).
    conns = wf.get("connections", {})
    for dead in REMOVE:
        if dead in conns:
            downstream = conns[dead]
            del conns[dead]
            for upstream_name, cdef in list(conns.items()):
                for outputs in cdef.get("main", []):
                    if outputs is None:
                        continue
                    new_outputs = []
                    redirected = False
                    for edge in outputs:
                        if edge.get("node") == dead:
                            redirected = True
                            if "main" in downstream and downstream["main"]:
                                for ds_edge in downstream["main"][0]:
                                    new_outputs.append(ds_edge)
                        else:
                            new_outputs.append(edge)
                    if redirected:
                        outputs.clear()
                        outputs.extend(new_outputs)

    # 4. Dedupe edges — an (upstream, output_index, node, type, index) tuple
    #    should only appear once.
    for upstream_name, cdef in conns.items():
        for outputs in cdef.get("main", []):
            if outputs is None:
                continue
            seen = set()
            deduped = []
            for edge in outputs:
                key = (edge.get("node"), edge.get("type"), edge.get("index"))
                if key not in seen:
                    seen.add(key)
                    deduped.append(edge)
            outputs.clear()
            outputs.extend(deduped)

    return wf


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: patch-n8n-doctrine.py <input.json> <output.json>")
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    wf = json.load(open(src, encoding='utf-8'))
    patched = patch(wf)
    json.dump(patched, open(dst, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    print(f"Patched workflow: {len(wf['nodes'])} nodes -> {len(patched['nodes'])} nodes")
    # Report connections
    removed_conns = set(wf.get("connections", {}).keys()) - set(patched.get("connections", {}).keys())
    print(f"Removed connections: {removed_conns or 'none'}")
    print(f"Wrote: {dst}")
