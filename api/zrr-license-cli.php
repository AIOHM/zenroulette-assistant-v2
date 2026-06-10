#!/usr/bin/env php
<?php
declare(strict_types=1);

$configFile = '/etc/zenroulette-license.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "Missing {$configFile}\n");
    exit(1);
}

$config = require $configFile;
$adminKey = is_array($config) ? trim((string)($config['admin_key'] ?? '')) : '';
if ($adminKey === '') {
    fwrite(STDERR, "License admin key is not configured.\n");
    exit(1);
}

$command = strtolower((string)($argv[1] ?? ''));
$requestId = isset($argv[2]) ? (int)$argv[2] : 0;
$payload = ['adminKey' => $adminKey];

if ($command === 'list') {
    $payload['action'] = 'license_pending_admin';
} elseif ($command === 'issue' && $requestId > 0) {
    $payload['action'] = 'license_issue_admin';
    $payload['requestId'] = $requestId;
} elseif ($command === 'resend' && $requestId > 0) {
    $payload['action'] = 'license_resend_admin';
    $payload['requestId'] = $requestId;
} elseif ($command === 'revoke' && $requestId > 0) {
    $payload['action'] = 'license_revoke_admin';
    $payload['requestId'] = $requestId;
} else {
    fwrite(STDERR, "Usage:\n");
    fwrite(STDERR, "  zrr-license list\n");
    fwrite(STDERR, "  zrr-license issue REQUEST_ID\n");
    fwrite(STDERR, "  zrr-license resend REQUEST_ID\n");
    fwrite(STDERR, "  zrr-license revoke REQUEST_ID\n");
    exit(1);
}

$ch = curl_init('https://zenroulette.com/api/index.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query($payload),
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    fwrite(STDERR, "API request failed: {$error}\n");
    exit(1);
}

$decoded = json_decode($response, true);
if (!is_array($decoded)) {
    fwrite(STDERR, "Unexpected API response (HTTP {$status}).\n");
    exit(1);
}

echo json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($status >= 200 && $status < 300 && !empty($decoded['success']) ? 0 : 1);
