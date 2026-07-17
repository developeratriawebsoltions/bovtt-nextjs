<?php
// webhook.php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// Include database connection
if (file_exists(__DIR__ . '/db.php')) {
    include __DIR__ . '/db.php';
} else {
    $conn = null;
}

// Set headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── WhatsApp API Credentials ─────────────────────────────────────────────────
$VERIFY_TOKEN = "bovtt_verify_token_2024";
$TOKEN        = "EAAdFbEtPbLABRyHG1WAtzeOSsUkMlaEDIsihvd233HvX5FNRRehwo1w0yil7OcTP2AiBQpHwTcNKZAEGbeZCooBMhB29YO7qXJbOSpwkGPSsbSpy44d7EChYFKrxjf6yW6xrIfboe18pj8pXWCQar6ZATurvljCQjIK6jmfnx9JsoI6dBF712oMbs7gbnwZDZD";
$PHONE_ID     = "1143254892206027";
$WABA_ID      = "952420607841173";
// ─────────────────────────────────────────────────────────────────────────────

// ─── Media Upload Configuration ──────────────────────────────────────────────
$UPLOAD_DIR      = __DIR__ . "/uploads/";
$UPLOAD_BASE_URL = "https://your-webhook-domain.com/uploads";

foreach (['images', 'videos', 'audio', 'documents', 'stickers'] as $folder) {
    $path = $UPLOAD_DIR . $folder;
    if (!file_exists($path)) {
        mkdir($path, 0755, true);
    }
}
// ─────────────────────────────────────────────────────────────────────────────

// =============================================================================
// ROUTE: GET — Webhook verification OR Template list fetch
// =============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['hub_verify_token']) && $_GET['hub_verify_token'] === $VERIFY_TOKEN) {
        echo $_GET['hub_challenge'];
        exit;
    }

    if (isset($_GET['action']) && $_GET['action'] === 'get_templates') {
        $templates = fetchTemplatesFromMeta(
            $GLOBALS['TOKEN'],
            $GLOBALS['WABA_ID'],
            $_GET['language'] ?? null,
            $_GET['category'] ?? null,
            $_GET['status']   ?? 'APPROVED',
            intval($_GET['limit'] ?? 20)
        );

        if ($conn && !$conn->connect_error && !empty($templates['data'])) {
            syncTemplatesToDB($conn, $templates['data']);
        }

        header("Content-Type: application/json");
        echo json_encode($templates, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(["error" => "Verification failed or unknown action"]);
    exit;
}

// =============================================================================
// ROUTE: POST — Incoming WhatsApp messages
// =============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents("php://input");
    file_put_contents("log.txt", $input . "\n", FILE_APPEND);

    $data    = json_decode($input, true);
    $message = $data['entry'][0]['changes'][0]['value']['messages'][0] ?? null;

    if ($message) {
        $from               = $message['from'];
        $type               = $message['type'];
        $content            = '';
        $buttonResponse     = '';
        $buttonId           = '';
        $replyToMessageId   = null;
        $replyToMessageText = null;

        // Media fields
        $media_id        = '';
        $media_url       = '';
        $local_file_path = '';
        $file_size       = 0;
        $mime_type       = '';

        // Reaction fields
        $reaction_emoji      = '';
        $reaction_message_id = '';

        // ── Reply/quote context ───────────────────────────────────────────────
        if (isset($message['context']['id'])) {
            $replyToMessageId = $message['context']['id'];

            if ($conn && !$conn->connect_error) {
                $stmt = $conn->prepare(
                    "SELECT message FROM `messages-new` WHERE message_id = ? LIMIT 1"
                );
                $stmt->bind_param("s", $replyToMessageId);
                $stmt->execute();
                $result = $stmt->get_result();
                if ($result->num_rows > 0) {
                    $replyToMessageText = $result->fetch_assoc()['message'];
                }
                $stmt->close();
            }
            error_log("[$from] replied to msg $replyToMessageId: $replyToMessageText");
        }

        // ── Message type switch ───────────────────────────────────────────────
        switch ($type) {
            case 'text':
                $content = trim($message['text']['body'] ?? '');
                break;

            case 'image':
                $media_id  = $message['image']['id']        ?? '';
                $content   = trim($message['image']['caption'] ?? '');
                $mime_type = $message['image']['mime_type'] ?? 'image/jpeg';
                $saved = downloadAndSaveMedia($media_id, $TOKEN, 'image', $mime_type);
                if ($saved) {
                    $local_file_path = $saved['local_path'];
                    $media_url       = $saved['public_url'];
                    $file_size       = $saved['file_size'];
                    $mime_type       = $saved['mime_type'];
                }
                break;

            case 'video':
                $media_id  = $message['video']['id']        ?? '';
                $content   = trim($message['video']['caption'] ?? '');
                $mime_type = $message['video']['mime_type'] ?? 'video/mp4';
                $saved = downloadAndSaveMedia($media_id, $TOKEN, 'video', $mime_type);
                if ($saved) {
                    $local_file_path = $saved['local_path'];
                    $media_url       = $saved['public_url'];
                    $file_size       = $saved['file_size'];
                    $mime_type       = $saved['mime_type'];
                }
                break;

            case 'audio':
                $media_id  = $message['audio']['id']        ?? '';
                $mime_type = $message['audio']['mime_type'] ?? 'audio/ogg';
                $saved = downloadAndSaveMedia($media_id, $TOKEN, 'audio', $mime_type);
                if ($saved) {
                    $local_file_path = $saved['local_path'];
                    $media_url       = $saved['public_url'];
                    $file_size       = $saved['file_size'];
                    $mime_type       = $saved['mime_type'];
                }
                break;

            case 'document':
                $media_id  = $message['document']['id']        ?? '';
                $content   = $message['document']['filename']   ?? '';
                $mime_type = $message['document']['mime_type']  ?? 'application/octet-stream';
                $saved = downloadAndSaveMedia($media_id, $TOKEN, 'document', $mime_type, $content);
                if ($saved) {
                    $local_file_path = $saved['local_path'];
                    $media_url       = $saved['public_url'];
                    $file_size       = $saved['file_size'];
                    $mime_type       = $saved['mime_type'];
                }
                break;

            case 'sticker':
                $media_id    = $message['sticker']['id']        ?? '';
                $mime_type   = $message['sticker']['mime_type'] ?? 'image/webp';
                $is_animated = !empty($message['sticker']['animated']);
                $content     = $is_animated ? 'animated_sticker' : 'static_sticker';
                $saved = downloadAndSaveMedia($media_id, $TOKEN, 'sticker', $mime_type);
                if ($saved) {
                    $local_file_path = $saved['local_path'];
                    $media_url       = $saved['public_url'];
                    $file_size       = $saved['file_size'];
                    $mime_type       = $saved['mime_type'];
                }
                error_log("[$from] sticker (" . ($is_animated ? 'animated' : 'static') . "): $media_url");
                break;

            case 'reaction':
                $reaction_emoji      = $message['reaction']['emoji']      ?? '';
                $reaction_message_id = $message['reaction']['message_id'] ?? '';
                $content             = $reaction_emoji;
                error_log("[$from] reacted '$reaction_emoji' to msg $reaction_message_id");
                break;

            case 'button':
                $buttonResponse = $message['button']['payload'] ?? $message['button']['text'] ?? '';
                $content        = $message['button']['text']    ?? $message['button']['payload'] ?? '';
                $buttonId       = $message['button']['id']      ?? '';
                break;

            default:
                if (isset($message['interactive'])) {
                    $interactive = $message['interactive'];
                    if ($interactive['type'] === 'button_reply') {
                        $buttonResponse = $interactive['button_reply']['id']    ?? '';
                        $content        = $interactive['button_reply']['title'] ?? '';
                        $buttonId       = $interactive['button_reply']['id']    ?? '';
                    } elseif ($interactive['type'] === 'list_reply') {
                        $buttonResponse = $interactive['list_reply']['id']          ?? '';
                        $content        = $interactive['list_reply']['title']       ?? '';
                        $buttonId       = $interactive['list_reply']['id']          ?? '';
                    }
                }
                break;
        }

        // ── Persist incoming message ──────────────────────────────────────────
        if ($conn && !$conn->connect_error) {
            $stmt = $conn->prepare(
                "INSERT INTO `messages-new`
                 (phone, message, type, direction, message_id,
                  reply_to_id, reply_to_message,
                  media_id, media_url, local_file_path, file_size, mime_type,
                  reaction_emoji, reaction_message_id,
                  created_at)
                 VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
            );
            $stmt->bind_param(
                "sssssssssiiss",
                $from, $content, $type, $message['id'],
                $replyToMessageId, $replyToMessageText,
                $media_id, $media_url, $local_file_path, $file_size, $mime_type,
                $reaction_emoji, $reaction_message_id
            );
            $stmt->execute();
            $stmt->close();

            if ($type === 'reaction' && !empty($reaction_message_id)) {
                $stmt2 = $conn->prepare(
                    "UPDATE `messages-new`
                     SET last_reaction = ?, last_reaction_by = ?, last_reaction_at = NOW()
                     WHERE message_id = ? LIMIT 1"
                );
                $stmt2->bind_param("sss", $reaction_emoji, $from, $reaction_message_id);
                $stmt2->execute();
                $stmt2->close();
            }
        }

        // ── Pass to bot (skip reactions and stickers) ─────────────────────────
        if ($type !== 'reaction' && $type !== 'sticker') {
            $userInput = !empty($buttonResponse) ? $buttonResponse : $content;
            $reply = processWithVisualFlow(
                $conn, $from, $userInput, $buttonId,
                $replyToMessageId, $replyToMessageText
            );

            if ($reply) {
                sendWhatsAppMessage($from, $reply, $TOKEN, $PHONE_ID);

                if ($conn && !$conn->connect_error) {
                    $stmt = $conn->prepare(
                        "INSERT INTO `messages-new`
                         (phone, message, type, direction, status, created_at)
                         VALUES (?, ?, 'text', 'outgoing', 'sent', NOW())"
                    );
                    $stmt->bind_param("ss", $from, $reply);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
    }

    echo json_encode(["status" => "success"]);
    exit;
}

// =============================================================================
// TEMPLATE API FUNCTIONS
// =============================================================================

function fetchTemplatesFromMeta($token, $wabaId, $language = null, $category = null, $status = 'APPROVED', $limit = 20) {
    $params = [
        'fields' => 'id,name,language,status,category,components,rejected_reason,quality_score',
        'limit'  => min($limit, 200),
    ];
    if ($status)   $params['status']   = strtoupper($status);
    if ($category) $params['category'] = strtoupper($category);
    if ($language) $params['language'] = $language;

    $url          = "https://graph.facebook.com/v18.0/{$wabaId}/message_templates?" . http_build_query($params);
    $allTemplates = [];
    $page         = 0;

    while ($url && $page < 10) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER,     ["Authorization: Bearer $token"]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT,        30);
        $response  = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            error_log("Template API HTTP $http_code: $response");
            break;
        }

        $decoded = json_decode($response, true);
        if (!empty($decoded['data'])) {
            $allTemplates = array_merge($allTemplates, $decoded['data']);
        }

        $url = $decoded['paging']['next'] ?? null;
        $page++;
    }

    return ['data' => $allTemplates, 'total' => count($allTemplates)];
}

function syncTemplatesToDB($conn, array $templates) {
    $conn->query("
        CREATE TABLE IF NOT EXISTS `bot_templates` (
            `id`              INT AUTO_INCREMENT PRIMARY KEY,
            `template_id`     VARCHAR(64)  NOT NULL DEFAULT '',
            `name`            VARCHAR(255) NOT NULL DEFAULT '',
            `language`        VARCHAR(20)  NOT NULL DEFAULT '',
            `status`          VARCHAR(30)  NOT NULL DEFAULT '',
            `category`        VARCHAR(50)  NOT NULL DEFAULT '',
            `components`      JSON,
            `quality_score`   JSON,
            `rejected_reason` TEXT,
            `synced_at`       DATETIME     NOT NULL,
            UNIQUE KEY `uniq_template` (`name`, `language`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $stmt = $conn->prepare(
        "INSERT INTO `bot_templates`
         (template_id, name, language, status, category, components, quality_score, rejected_reason, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           template_id     = VALUES(template_id),
           status          = VALUES(status),
           category        = VALUES(category),
           components      = VALUES(components),
           quality_score   = VALUES(quality_score),
           rejected_reason = VALUES(rejected_reason),
           synced_at       = NOW()"
    );

    $synced = 0;
    foreach ($templates as $tpl) {
        $tpl_id          = $tpl['id']              ?? '';
        $name            = $tpl['name']            ?? '';
        $language        = $tpl['language']        ?? '';
        $status          = $tpl['status']          ?? '';
        $category        = $tpl['category']        ?? '';
        $components      = json_encode($tpl['components']    ?? []);
        $quality_score   = json_encode($tpl['quality_score'] ?? []);
        $rejected_reason = $tpl['rejected_reason'] ?? null;

        $stmt->bind_param(
            "ssssssss",
            $tpl_id, $name, $language, $status, $category,
            $components, $quality_score, $rejected_reason
        );
        if ($stmt->execute()) $synced++;
    }
    $stmt->close();
    error_log("syncTemplatesToDB: synced $synced / " . count($templates) . " templates.");
}

// =============================================================================
// MEDIA FUNCTIONS
// =============================================================================

function downloadAndSaveMedia($media_id, $token, $type, $mime_type, $filename = '') {
    if (!$media_id) return null;

    global $UPLOAD_DIR, $UPLOAD_BASE_URL;

    try {
        $ch = curl_init("https://graph.facebook.com/v18.0/{$media_id}");
        curl_setopt($ch, CURLOPT_HTTPHEADER,     ["Authorization: Bearer $token"]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT,        15);
        $response  = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            error_log("Media info failed for $media_id HTTP $http_code");
            return null;
        }

        $download_url = json_decode($response, true)['url'] ?? null;
        if (!$download_url) return null;

        $ch = curl_init($download_url);
        curl_setopt($ch, CURLOPT_HTTPHEADER,     ["Authorization: Bearer $token"]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT,        60);
        $file_content = curl_exec($ch);
        $http_code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200 || empty($file_content)) return null;

        $folderMap = [
            'image'    => 'images',
            'video'    => 'videos',
            'audio'    => 'audio',
            'document' => 'documents',
            'sticker'  => 'stickers',
        ];
        $folder = $folderMap[$type] ?? 'documents';

        $extension = getExtensionFromMimeType($mime_type);
        $unique_id = uniqid() . '_' . time();
        $file_name = ($filename && $type === 'document')
            ? $unique_id . '_' . preg_replace('/[^a-zA-Z0-9.-]/', '_', $filename)
            : $unique_id . '.' . $extension;

        $local_path = $UPLOAD_DIR . $folder . '/' . $file_name;
        $public_url = $UPLOAD_BASE_URL . '/' . $folder . '/' . $file_name;

        if (file_put_contents($local_path, $file_content) !== false) {
            error_log("Media saved: $local_path");
            return [
                'local_path' => "/uploads/{$folder}/{$file_name}",
                'public_url' => $public_url,
                'file_size'  => strlen($file_content),
                'mime_type'  => $mime_type,
            ];
        }

        error_log("Failed to write: $local_path");
        return null;

    } catch (Exception $e) {
        error_log("downloadAndSaveMedia: " . $e->getMessage());
        return null;
    }
}

function getExtensionFromMimeType($mime_type) {
    $map = [
        'image/jpeg'       => 'jpg',
        'image/jpg'        => 'jpg',
        'image/png'        => 'png',
        'image/gif'        => 'gif',
        'image/webp'       => 'webp',
        'video/mp4'        => 'mp4',
        'video/mpeg'       => 'mpg',
        'video/quicktime'  => 'mov',
        'audio/mpeg'       => 'mp3',
        'audio/mp3'        => 'mp3',
        'audio/ogg'        => 'ogg',
        'audio/wav'        => 'wav',
        'application/pdf'  => 'pdf',
        'application/msword'  => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'text/plain'       => 'txt',
    ];
    return $map[$mime_type] ?? 'bin';
}

// =============================================================================
// VISUAL FLOW BOT ENGINE
// =============================================================================

function processWithVisualFlow($conn, $phone, $userInput, $buttonId = '', $replyToId = null, $replyToText = null) {
    $session = getUserSession($conn, $phone);

    if ($session && !empty($session['current_flow_id'])) {
        return processFlowNode(
            $conn, $phone,
            $session['current_flow_id'], $session['current_node_id'],
            $userInput, $session, $buttonId, $replyToId, $replyToText
        );
    }

    $triggeredFlow = getFlowByTriggerKeyword($conn, $userInput);
    if ($triggeredFlow && !empty($triggeredFlow['id'])) {
        return startFlow($conn, $phone, $triggeredFlow['id'], $userInput);
    }

    return null;
}

function getUserSession($conn, $phone) {
    if (!$conn || $conn->connect_error) return null;

    $stmt = $conn->prepare("SELECT * FROM user_sessions WHERE phone = ?");
    if (!$stmt) return null;
    $stmt->bind_param("s", $phone);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $stmt->close();
        $d = json_decode($row['data'], true) ?? [];
        
        error_log("Session loaded for $phone - Flow: {$d['current_flow_id']}, Node: {$d['current_node_id']}, Awaiting: " . ($d['awaiting_button'] ? 'Button' : ($d['awaiting_question'] ? 'Question' : 'None')) . ", Vars: " . count($d['variables'] ?? []));
        
        return [
            'phone'           => $row['phone'],
            'state'           => $row['state'],
            'current_flow_id' => $d['current_flow_id'] ?? null,
            'current_node_id' => $d['current_node_id'] ?? null,
            'flow_data'       => $d['flow_data']       ?? null,
            'variables'       => $d['variables']       ?? [],
            'awaiting_button' => $d['awaiting_button'] ?? false,
            'awaiting_question' => $d['awaiting_question'] ?? false,
            'question_node_id' => $d['question_node_id'] ?? null,
            'last_message_id' => $d['last_message_id'] ?? null,
            'pending_template' => $d['pending_template'] ?? null,
        ];
    }
    $stmt->close();
    return null;
}

function updateUserSession($conn, $phone, $state, $data = null) {
    if (!$conn || $conn->connect_error) return false;

    $jsonData  = json_encode($data);
    $checkStmt = $conn->prepare("SELECT id FROM user_sessions WHERE phone = ?");
    $checkStmt->bind_param("s", $phone);
    $checkStmt->execute();
    $exists = $checkStmt->get_result()->num_rows > 0;
    $checkStmt->close();

    if ($exists) {
        $stmt = $conn->prepare(
            "UPDATE user_sessions SET state = ?, data = ?, updated_at = NOW() WHERE phone = ?"
        );
        if (!$stmt) return false;
        $stmt->bind_param("sss", $state, $jsonData, $phone);
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO user_sessions (phone, state, data, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())"
        );
        if (!$stmt) return false;
        $stmt->bind_param("sss", $phone, $state, $jsonData);
    }
    $result = $stmt->execute();
    $stmt->close();
    
    error_log("Session updated for $phone - State: $state, Data keys: " . json_encode(array_keys($data ?? [])));
    
    return $result;
}

function clearUserSession($conn, $phone) {
    if (!$conn || $conn->connect_error) return false;
    $stmt = $conn->prepare("DELETE FROM user_sessions WHERE phone = ?");
    if (!$stmt) return false;
    $stmt->bind_param("s", $phone);
    $result = $stmt->execute();
    $stmt->close();
    error_log("Session cleared for $phone");
    return $result;
}

function getFlowByTriggerKeyword($conn, $input) {
    if (!$conn || $conn->connect_error) return null;
    $input = strtolower(trim($input));
    $stmt  = $conn->prepare(
        "SELECT * FROM bot_flows WHERE LOWER(trigger_keyword) = ? AND is_active = 1 LIMIT 1"
    );
    if (!$stmt) return null;
    $stmt->bind_param("s", $input);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        $flow = $result->fetch_assoc();
        $stmt->close();
        return $flow;
    }
    $stmt->close();
    return null;
}

function startFlow($conn, $phone, $flowId, $initialInput) {
    if (!$conn || $conn->connect_error) return null;

    $stmt = $conn->prepare("SELECT flow_data FROM bot_flows WHERE id = ?");
    if (!$stmt) return null;
    $stmt->bind_param("i", $flowId);
    $stmt->execute();
    $flow = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$flow) return null;

    $flowData = json_decode($flow['flow_data'], true);
    if (!$flowData) return null;

    $nodes = $flowData['nodes'] ?? [];
    $edges = $flowData['edges'] ?? [];

    $startNode = null;
    foreach ($nodes as $node) {
        if ($node['type'] === 'start') { $startNode = $node; break; }
    }
    if (!$startNode) return null;

    $firstNode = null;
    foreach ($edges as $edge) {
        if ($edge['source'] === $startNode['id']) { $firstNode = $edge['target']; break; }
    }
    if (!$firstNode) return null;

    updateUserSession($conn, $phone, 'in_flow', [
        'current_flow_id' => $flowId,
        'current_node_id' => $firstNode,
        'flow_data'       => $flowData,
        'variables'       => ['last_input' => $initialInput],
        'awaiting_button' => false,
        'awaiting_question' => false,
        'question_node_id' => null,
        'last_message_id' => null,
    ]);

    return processFlowNode($conn, $phone, $flowId, $firstNode, $initialInput, null);
}

function processFlowNode(
    $conn, $phone, $flowId, $nodeId, $userInput,
    $session = null, $buttonId = '', $replyToId = null, $replyToText = null
) {
    if (!$conn || $conn->connect_error) return null;

    if (!$session) $session = getUserSession($conn, $phone);
    if (!$session) return null;

    $flowData = $session['flow_data'];
    if (!$flowData) return null;

    $nodes = $flowData['nodes'] ?? [];
    $edges = $flowData['edges'] ?? [];

    $currentNode = null;
    foreach ($nodes as $node) {
        if ($node['id'] === $nodeId) { $currentNode = $node; break; }
    }
    if (!$currentNode) {
        error_log("Node $nodeId not found in flow $flowId");
        return null;
    }

    $variables = $session['variables'];
    $awaitingButton = $session['awaiting_button'] ?? false;
    $awaitingQuestion = $session['awaiting_question'] ?? false;

    if ($replyToId) {
        $variables['replied_to_message_id'] = $replyToId;
        $variables['replied_to_message_text'] = $replyToText;
    }

    error_log("Processing node [{$currentNode['type']}] for $phone - Awaiting: " . ($awaitingButton ? 'Button' : ($awaitingQuestion ? 'Question' : 'None')) . " - Input: '$userInput'");

    switch ($currentNode['type']) {

        case 'start':
            $next = findNextNode($edges, $nodeId);
            if ($next) {
                updateUserSession($conn, $phone, 'in_flow', [
                    'current_flow_id' => $flowId, 
                    'current_node_id' => $next,
                    'flow_data' => $flowData, 
                    'variables' => $variables,
                    'awaiting_button' => false, 
                    'awaiting_question' => false,
                    'question_node_id' => null,
                    'last_message_id' => null,
                ]);
                return processFlowNode($conn, $phone, $flowId, $next, $userInput);
            }
            break;

        case 'message':
            $text = $currentNode['data']['message'] ?? '';
            if (empty($text)) return null;
            foreach ($variables as $key => $value) {
                $text = str_replace("{{" . $key . "}}", $value, $text);
            }
            $next = findNextNode($edges, $nodeId);
            if ($next) {
                updateUserSession($conn, $phone, 'in_flow', [
                    'current_flow_id' => $flowId, 
                    'current_node_id' => $next,
                    'flow_data' => $flowData, 
                    'variables' => $variables,
                    'awaiting_button' => false, 
                    'awaiting_question' => false,
                    'question_node_id' => null,
                    'last_message_id' => null,
                ]);
                return $text;
            }
            clearUserSession($conn, $phone);
            return $text;

        case 'question':
            // If we're awaiting a response to this question
            if ($awaitingQuestion) {
                $saveAs = $currentNode['data']['save_as_variable'] ?? '';
                if ($saveAs) {
                    $variables[$saveAs] = $userInput;
                    error_log("Saved user input '$userInput' to variable '$saveAs'");
                }
                
                // CRITICAL FIX: Get all outgoing edges from this question node
                $outgoingEdges = [];
                foreach ($edges as $edge) {
                    if ($edge['source'] === $nodeId) {
                        $outgoingEdges[] = $edge;
                        error_log("Found outgoing edge to node {$edge['target']} with condition: " . ($edge['condition'] ?? 'none'));
                    }
                }
                
                $nextNodeId = null;
                
                // Try to match user input with edge conditions
                foreach ($outgoingEdges as $edge) {
                    $condition = $edge['condition'] ?? '';
                    
                    if (!empty($condition)) {
                        error_log("Evaluating condition: '$condition' against user input: '$userInput'");
                        // Evaluate condition against user input
                        if (evaluateCondition($condition, $userInput, $variables)) {
                            $nextNodeId = $edge['target'];
                            error_log("✅ Condition MATCHED! Moving to node: $nextNodeId");
                            break;
                        } else {
                            error_log("❌ Condition did NOT match: '$condition'");
                        }
                    }
                }
                
                // If no condition matched, take the first edge
                if (!$nextNodeId && !empty($outgoingEdges)) {
                    $nextNodeId = $outgoingEdges[0]['target'];
                    error_log("No matching condition, taking default edge to node: $nextNodeId");
                }
                
                if ($nextNodeId) {
                    updateUserSession($conn, $phone, 'in_flow', [
                        'current_flow_id' => $flowId, 
                        'current_node_id' => $nextNodeId,
                        'flow_data' => $flowData, 
                        'variables' => $variables,
                        'awaiting_button' => false, 
                        'awaiting_question' => false,
                        'question_node_id' => null,
                        'last_message_id' => null,
                    ]);
                    return processFlowNode($conn, $phone, $flowId, $nextNodeId, $userInput, null);
                }
                
                // If no next node found, clear session
                error_log("No next node found for question response '$userInput'");
                clearUserSession($conn, $phone);
                return "Thank you for your response!";
            }
            
            // First time showing the question
            $questionText = $currentNode['data']['message'] ?? 'Please answer:';
            $options = $currentNode['data']['options'] ?? [];
            
            $formattedQuestion = $questionText;
            if (!empty($options)) {
                $buttonOptions = [];
                foreach ($options as $opt) {
                    if (!empty($opt['text'])) {
                        $buttonOptions[] = $opt['text'];
                    }
                }
                if (!empty($buttonOptions)) {
                    $formattedQuestion .= "\n\nPlease select an option:\n" . implode("\n", $buttonOptions);
                }
            }
            
            // Set awaiting_question = true to wait for response
            updateUserSession($conn, $phone, 'in_flow', [
                'current_flow_id' => $flowId, 
                'current_node_id' => $nodeId,
                'flow_data' => $flowData, 
                'variables' => $variables,
                'awaiting_button' => false, 
                'awaiting_question' => true,
                'question_node_id' => $nodeId,
                'last_message_id' => null,
            ]);
            
            return $formattedQuestion;

        case 'template':
            $templateName = $currentNode['data']['template_name'] ?? null;
            if (!$templateName) {
                error_log("Template node missing template_name");
                return null;
            }
            
            // If we're awaiting a button response from a template
            if ($awaitingButton) {
                error_log("Processing button response for template '$templateName' - User selected: '$userInput'");
                
                // Store the button selection in variables
                $variables['last_button_clicked'] = $userInput;
                $variables['button_id'] = $buttonId;
                
                // Get all outgoing edges from this template node
                $outgoingEdges = [];
                foreach ($edges as $edge) {
                    if ($edge['source'] === $nodeId) {
                        $outgoingEdges[] = $edge;
                        error_log("Found outgoing edge to node {$edge['target']} with condition: " . ($edge['condition'] ?? 'none'));
                    }
                }
                
                $nextNodeId = null;
                
                // Try to match button click with edge conditions
                foreach ($outgoingEdges as $edge) {
                    $condition = $edge['condition'] ?? '';
                    
                    if (!empty($condition)) {
                        error_log("Evaluating condition: '$condition' against button click: '$userInput'");
                        if (evaluateCondition($condition, $userInput, $variables)) {
                            $nextNodeId = $edge['target'];
                            error_log("✅ Condition MATCHED! Moving to node: $nextNodeId");
                            break;
                        } else {
                            error_log("❌ Condition did NOT match: '$condition'");
                        }
                    }
                }
                
                // If no condition matched, take the first edge
                if (!$nextNodeId && !empty($outgoingEdges)) {
                    $nextNodeId = $outgoingEdges[0]['target'];
                    error_log("No matching condition, taking default edge to node: $nextNodeId");
                }
                
                if ($nextNodeId) {
                    updateUserSession($conn, $phone, 'in_flow', [
                        'current_flow_id' => $flowId, 
                        'current_node_id' => $nextNodeId,
                        'flow_data' => $flowData,
                        'variables' => $variables,
                        'awaiting_button' => false, 
                        'awaiting_question' => false,
                        'question_node_id' => null,
                        'last_message_id' => null,
                    ]);
                    return processFlowNode($conn, $phone, $flowId, $nextNodeId, $userInput, null);
                }
                
                error_log("No next node found for button '$userInput' in template '$templateName'");
                clearUserSession($conn, $phone);
                return null;
            }
            
            // First time sending the template
            $imageMediaId = $currentNode['data']['header_image_id'] ?? null;
            $hasImageHeader = $currentNode['data']['has_image_header'] ?? false;
            
            // Extract and process template variables
            $templateVariables = [];
            $templateVarsObj = $currentNode['data']['template_variables'] ?? [];
            if (!empty($templateVarsObj) && is_array($templateVarsObj)) {
                foreach ($templateVarsObj as $varValue) {
                    $processedValue = $varValue;
                    foreach ($variables as $key => $val) {
                        $processedValue = str_replace("{{" . $key . "}}", $val, $processedValue);
                    }
                    $templateVariables[] = $processedValue;
                }
            }
            
            error_log("Sending template '$templateName' to $phone with variables: " . json_encode($templateVariables));
            
            // Send the template message
            if ($hasImageHeader && $imageMediaId) {
                sendTemplateMessageWithImage($phone, $templateName, $GLOBALS['TOKEN'], $GLOBALS['PHONE_ID'], $imageMediaId, $templateVariables);
            } else {
                sendTemplateMessage($phone, $templateName, $GLOBALS['TOKEN'], $GLOBALS['PHONE_ID'], [], 'en', $templateVariables);
            }
            
            // Keep session on same node, waiting for button response
            updateUserSession($conn, $phone, 'in_flow', [
                'current_flow_id' => $flowId, 
                'current_node_id' => $nodeId,
                'flow_data' => $flowData, 
                'variables' => $variables,
                'awaiting_button' => true,
                'awaiting_question' => false,
                'question_node_id' => null,
                'last_message_id' => null,
                'pending_template' => $templateName,
            ]);
            
            return null;

        case 'condition':
            $cond = $currentNode['data']['condition'] ?? '';
            $evaluated = evaluateCondition($cond, $userInput, $variables);
            error_log("Condition node '$cond' evaluated to " . ($evaluated ? 'TRUE' : 'FALSE'));

            $next = null;
            foreach ($edges as $edge) {
                if ($edge['source'] === $nodeId) {
                    $ec = $edge['condition'] ?? '';
                    if (($ec === 'true' && $evaluated) || ($ec === 'false' && !$evaluated)) {
                        $next = $edge['target']; 
                        error_log("Taking edge with condition '$ec' to node $next");
                        break;
                    } elseif (empty($ec) && !$next) {
                        $next = $edge['target'];
                        error_log("Taking default edge to node $next");
                    }
                }
            }
            
            if ($next) {
                updateUserSession($conn, $phone, 'in_flow', [
                    'current_flow_id' => $flowId, 
                    'current_node_id' => $next,
                    'flow_data' => $flowData, 
                    'variables' => $variables,
                    'awaiting_button' => false, 
                    'awaiting_question' => false,
                    'question_node_id' => null,
                    'last_message_id' => null,
                ]);
                return processFlowNode($conn, $phone, $flowId, $next, $userInput, null);
            }
            break;
            
        case 'variable':
            $varName = $currentNode['data']['variable_name'] ?? '';
            $varValue = $currentNode['data']['variable_value'] ?? '';
            if ($varName && $varValue) {
                foreach ($variables as $key => $val) {
                    $varValue = str_replace("{{" . $key . "}}", $val, $varValue);
                }
                $variables[$varName] = $varValue;
                error_log("Set variable '$varName' = '$varValue'");
            }
            
            $next = findNextNode($edges, $nodeId);
            if ($next) {
                updateUserSession($conn, $phone, 'in_flow', [
                    'current_flow_id' => $flowId, 
                    'current_node_id' => $next,
                    'flow_data' => $flowData, 
                    'variables' => $variables,
                    'awaiting_button' => false, 
                    'awaiting_question' => false,
                    'question_node_id' => null,
                    'last_message_id' => null,
                ]);
                return processFlowNode($conn, $phone, $flowId, $next, $userInput, null);
            }
            break;

        case 'end':
            clearUserSession($conn, $phone);
            $endMessage = $currentNode['data']['message'] ?? 'Thank you! Conversation ended.';
            foreach ($variables as $key => $value) {
                $endMessage = str_replace("{{" . $key . "}}", $value, $endMessage);
            }
            return $endMessage;
    }

    return null;
}

function findNextNode($edges, $currentNodeId) {
    foreach ($edges as $edge) {
        if ($edge['source'] === $currentNodeId) return $edge['target'];
    }
    return null;
}

function evaluateCondition($condition, $userInput, $variables) {
    $userInput = strtolower(trim($userInput));
    $condition = strtolower(trim($condition));

    error_log("Evaluating condition: '$condition' with input: '$userInput'");

    // Check for direct user_input comparison
    if (preg_match('/user_input\s*==\s*"([^"]+)"/', $condition, $m)) {
        $expected = strtolower(trim($m[1]));
        $result = $userInput === $expected;
        error_log("User input equals: '$userInput' == '$expected' = " . ($result ? 'true' : 'false'));
        return $result;
    }
    
    // Check for user_input contains
    if (preg_match('/user_input\s*contains\s*"([^"]+)"/', $condition, $m)) {
        $expected = strtolower(trim($m[1]));
        $result = strpos($userInput, $expected) !== false;
        error_log("User input contains: '$userInput' contains '$expected' = " . ($result ? 'true' : 'false'));
        return $result;
    }

    // Check for variable comparison
    if (preg_match('/(\w+)\s*==\s*"([^"]+)"/', $condition, $matches)) {
        $varName = $matches[1];
        $expected = strtolower(trim($matches[2]));
        $actual = isset($variables[$varName]) ? strtolower(trim($variables[$varName])) : '';
        $result = $actual === $expected;
        error_log("Variable equals: $varName ($actual) == $expected = " . ($result ? 'true' : 'false'));
        return $result;
    }

    // Check for variable contains
    if (preg_match('/(\w+)\s*contains\s*"([^"]+)"/', $condition, $matches)) {
        $varName = $matches[1];
        $expected = strtolower(trim($matches[2]));
        $actual = isset($variables[$varName]) ? strtolower(trim($variables[$varName])) : '';
        $result = strpos($actual, $expected) !== false;
        error_log("Variable contains: $varName ($actual) contains $expected = " . ($result ? 'true' : 'false'));
        return $result;
    }

    // Check for button/option shortcuts (just the word itself)
    // This handles simple conditions like "yes" or "no" without user_input prefix
    $simpleMatch = $condition;
    if ($userInput === $simpleMatch) {
        error_log("Simple match: '$userInput' equals condition '$simpleMatch' = true");
        return true;
    }

    return false;
}

// =============================================================================
// WHATSAPP SEND HELPERS
// =============================================================================

function sendTemplateMessageWithImage($to, $templateName, $token, $phoneId, $imageMediaId = null, $variables = [], $languageCode = 'en') {
    $url = "https://graph.facebook.com/v18.0/$phoneId/messages";
    
    $template = [
        "name" => $templateName,
        "language" => ["code" => $languageCode]
    ];
    
    $components = [];
    
    if ($imageMediaId) {
        $components[] = [
            "type" => "header",
            "parameters" => [
                [
                    "type" => "image",
                    "image" => ["id" => $imageMediaId]
                ]
            ]
        ];
    }
    
    if (!empty($variables)) {
        $bodyParams = [];
        foreach ($variables as $var) {
            if (!empty($var)) {
                $bodyParams[] = ["type" => "text", "text" => $var];
            }
        }
        if (!empty($bodyParams)) {
            $components[] = ["type" => "body", "parameters" => $bodyParams];
        }
    }
    
    if (!empty($components)) {
        $template["components"] = $components;
    }
    
    $data = [
        "messaging_product" => "whatsapp",
        "to" => $to,
        "type" => "template",
        "template" => $template
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token", "Content-Type: application/json"]);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    error_log("sendTemplateMessageWithImage [$templateName → $to]: " . substr($response, 0, 500));
    return json_decode($response, true);
}

function sendTemplateMessage($to, $templateName, $token, $phoneId, $components = [], $languageCode = 'en', $variables = []) {
    $url = "https://graph.facebook.com/v18.0/$phoneId/messages";
    $tpl = [
        "name"     => $templateName,
        "language" => ["code" => $languageCode],
    ];
    
    if (!empty($variables)) {
        $bodyParams = [];
        foreach ($variables as $var) {
            if (!empty($var)) {
                $bodyParams[] = ["type" => "text", "text" => $var];
            }
        }
        if (!empty($bodyParams)) {
            $components[] = ["type" => "body", "parameters" => $bodyParams];
        }
    }
    
    if (!empty($components)) {
        $tpl['components'] = $components;
    }
    
    $data = [
        "messaging_product" => "whatsapp",
        "to"                => $to,
        "type"              => "template",
        "template"          => $tpl,
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token", "Content-Type: application/json"]);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);
    error_log("sendTemplateMessage [$templateName → $to]: " . substr($response, 0, 500));
    return json_decode($response, true);
}

function sendWhatsAppMessage($to, $message, $token, $phoneId) {
    $url  = "https://graph.facebook.com/v18.0/$phoneId/messages";
    $data = [
        "messaging_product" => "whatsapp",
        "to"                => $to,
        "type"              => "text",
        "text"              => ["body" => $message],
    ];
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token", "Content-Type: application/json"]);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_exec($ch);
    curl_close($ch);
}
?>