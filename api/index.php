<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'msg' => 'POST required.']);
    exit;
}

$wpLoad = dirname(__DIR__) . '/wp-load.php';
if (!is_file($wpLoad)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'msg' => 'Server configuration error.']);
    exit;
}

require_once $wpLoad;

function zrr_json(array $payload, int $status = 200): void {
    http_response_code($status);
    echo wp_json_encode($payload);
    exit;
}

function zrr_email($value): string {
    return strtolower(trim((string)$value));
}

function zrr_device_id($value): string {
    $normalized = preg_replace('/[^a-zA-Z0-9\-_]/', '', trim((string)$value));
    return is_string($normalized) ? substr($normalized, 0, 190) : '';
}

function zrr_license_code($value): string {
    $normalized = preg_replace('/[^A-Z0-9\-]/', '', strtoupper(trim((string)$value)));
    return is_string($normalized) ? $normalized : '';
}

function zrr_now(): string {
    return gmdate('Y-m-d H:i:s');
}

function zrr_mysql_after(int $seconds): string {
    return gmdate('Y-m-d H:i:s', time() + $seconds);
}

function zrr_iso(?string $mysqlDate): ?string {
    if (!$mysqlDate) {
        return null;
    }
    $timestamp = strtotime($mysqlDate . ' UTC');
    return $timestamp === false ? null : gmdate('c', $timestamp);
}

function zrr_config(): array {
    $configFile = '/etc/zenroulette-license.php';
    $config = is_file($configFile) ? require $configFile : [];
    return is_array($config) ? $config : [];
}

function zrr_admin_key(): string {
    $config = zrr_config();
    $configured = trim((string)($config['admin_key'] ?? ''));
    if ($configured !== '') {
        return $configured;
    }
    return trim((string)getenv('ZRR_LICENSE_ADMIN_KEY'));
}

function zrr_require_admin(): void {
    $expected = zrr_admin_key();
    $provided = trim((string)($_POST['adminKey'] ?? ''));
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        zrr_json(['success' => false, 'msg' => 'Admin authorization failed.'], 403);
    }
}

function zrr_rate_limit(string $bucket, int $limit, int $windowSeconds): void {
    $key = 'zrr_rl_' . hash('sha256', $bucket);
    $count = get_transient($key);
    if ($count === false) {
        set_transient($key, 1, $windowSeconds);
        return;
    }
    if ((int)$count >= $limit) {
        zrr_json(['success' => false, 'msg' => 'Too many requests. Please try again later.'], 429);
    }
    set_transient($key, (int)$count + 1, $windowSeconds);
}

function zrr_generate_code(): string {
    return 'ZRA24-' . strtoupper(bin2hex(random_bytes(24)));
}

function zrr_table(): string {
    global $wpdb;
    return $wpdb->prefix . 'zrr_whatsapp_licenses';
}

function zrr_ensure_schema(): void {
    global $wpdb;
    $version = '3';
    $table = zrr_table();
    if (get_option('zrr_license_schema_version') === $version) {
        if (get_option('zrr_license_nullable_device_migrated') !== '1') {
            $wpdb->query("ALTER TABLE {$table} MODIFY request_device_id varchar(190) DEFAULT NULL");
            update_option('zrr_license_nullable_device_migrated', '1', false);
        }
        return;
    }

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        email varchar(190) NOT NULL,
        request_device_id varchar(190) DEFAULT NULL,
        activation_device_id varchar(190) DEFAULT NULL,
        license_code_hash char(64) DEFAULT NULL,
        license_code_last4 varchar(4) DEFAULT NULL,
        license_code_ciphertext text DEFAULT NULL,
        status varchar(20) NOT NULL DEFAULT 'requested',
        source varchar(30) NOT NULL DEFAULT 'extension',
        source_reference varchar(190) DEFAULT NULL,
        requested_at datetime NOT NULL,
        issued_at datetime DEFAULT NULL,
        code_expires_at datetime DEFAULT NULL,
        activated_at datetime DEFAULT NULL,
        expires_at datetime DEFAULT NULL,
        revoked_at datetime DEFAULT NULL,
        email_status varchar(20) DEFAULT NULL,
        email_sent_at datetime DEFAULT NULL,
        admin_notified_at datetime DEFAULT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY license_code_hash (license_code_hash),
        UNIQUE KEY source_reference (source, source_reference),
        KEY email_request_device (email, request_device_id),
        KEY email_activation_device (email, activation_device_id),
        KEY status_requested (status, requested_at)
    ) {$charset};";
    dbDelta($sql);
    $wpdb->query("ALTER TABLE {$table} MODIFY request_device_id varchar(190) DEFAULT NULL");
    update_option('zrr_license_nullable_device_migrated', '1', false);
    update_option('zrr_license_schema_version', $version, false);
}

function zrr_client_ip_hash(): string {
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    return hash_hmac('sha256', $ip, wp_salt('auth'));
}

function zrr_membership_label(WP_User $user): string {
    $roles = array_values((array)$user->roles);
    foreach ($roles as $role) {
        $normalized = strtolower((string)$role);
        if ($normalized === 'club' || $normalized === 'club_member' || str_contains($normalized, 'club')) {
            return 'club';
        }
    }

    $planIds = get_user_meta($user->ID, 'arm_user_plan_ids', true);
    if (!is_array($planIds)) {
        $planIds = $planIds === '' ? [] : [$planIds];
    }

    global $arm_subscription_plans;
    $planNames = [];
    if (is_object($arm_subscription_plans) && method_exists($arm_subscription_plans, 'arm_get_plan_name_by_id')) {
        foreach (array_unique(array_map('intval', $planIds)) as $planId) {
            if ($planId <= 0) {
                continue;
            }
            $planName = trim((string)$arm_subscription_plans->arm_get_plan_name_by_id($planId));
            if ($planName !== '') {
                $planNames[] = strtolower($planName);
            }
        }
    }

    foreach ($planNames as $planName) {
        if (str_contains($planName, 'club')) {
            return 'club';
        }
    }
    foreach ($planNames as $planName) {
        if (str_contains($planName, 'tribe')) {
            return 'tribe';
        }
    }

    if (in_array('armember', $roles, true)) {
        return 'tribe';
    }
    if (in_array('administrator', $roles, true)) {
        return 'administrator';
    }
    return 'wordpress';
}

zrr_ensure_schema();

global $wpdb;
$table = zrr_table();
$action = sanitize_key((string)($_POST['action'] ?? ''));

if ($action === 'license_request') {
    $email = zrr_email($_POST['email'] ?? '');
    $deviceId = zrr_device_id($_POST['deviceId'] ?? '');

    if (!is_email($email) || strlen($deviceId) < 8) {
        zrr_json(['success' => false, 'msg' => 'A valid email and installation ID are required.'], 400);
    }

    zrr_rate_limit('license_request_ip:' . zrr_client_ip_hash(), 20, HOUR_IN_SECONDS);
    zrr_rate_limit('license_request_identity:' . $email . ':' . $deviceId, 4, HOUR_IN_SECONDS);

    $active = $wpdb->get_row($wpdb->prepare(
        "SELECT id, expires_at
         FROM {$table}
         WHERE email = %s
           AND activation_device_id = %s
           AND status = 'activated'
           AND expires_at > %s
         ORDER BY id DESC
         LIMIT 1",
        $email,
        $deviceId,
        zrr_now()
    ), ARRAY_A);

    if ($active) {
        zrr_json([
            'success' => true,
            'duplicate' => true,
            'alreadyActive' => true,
            'requestId' => (int)$active['id'],
            'expiresAt' => zrr_iso($active['expires_at']),
            'msg' => 'License already active on this installation.',
        ]);
    }

    $pending = $wpdb->get_row($wpdb->prepare(
        "SELECT id, requested_at, code_expires_at
         FROM {$table}
         WHERE email = %s
           AND request_device_id = %s
           AND status IN ('requested', 'issued')
           AND (
                (status = 'requested' AND requested_at > %s)
                OR
                (status = 'issued' AND code_expires_at > %s)
           )
         ORDER BY id DESC
         LIMIT 1",
        $email,
        $deviceId,
        gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS),
        zrr_now()
    ), ARRAY_A);

    if ($pending) {
        $requestExpiry = $pending['code_expires_at']
            ?: gmdate('Y-m-d H:i:s', strtotime($pending['requested_at'] . ' UTC') + DAY_IN_SECONDS);
        zrr_json([
            'success' => true,
            'duplicate' => true,
            'requestId' => (int)$pending['id'],
            'expiresAt' => zrr_iso($requestExpiry),
        ]);
    }

    $inserted = $wpdb->insert($table, [
        'email' => $email,
        'request_device_id' => $deviceId,
        'status' => 'requested',
        'source' => 'extension',
        'requested_at' => zrr_now(),
    ], ['%s', '%s', '%s', '%s', '%s']);

    if ($inserted !== 1) {
        zrr_json(['success' => false, 'msg' => 'Unable to create license request.'], 500);
    }

    $requestId = (int)$wpdb->insert_id;
    $adminNotified = function_exists('zrr_license_notify_admin_request')
        && zrr_license_notify_admin_request($requestId, $email, $deviceId);
    $wpdb->update($table, [
        'admin_notified_at' => $adminNotified ? zrr_now() : null,
    ], ['id' => $requestId], ['%s'], ['%d']);

    zrr_json([
        'success' => true,
        'duplicate' => false,
        'requestId' => $requestId,
        'expiresAt' => zrr_iso(zrr_mysql_after(DAY_IN_SECONDS)),
        'adminNotified' => $adminNotified,
    ]);
}

if ($action === 'license_issue_admin') {
    zrr_require_admin();
    $requestId = (int)($_POST['requestId'] ?? 0);
    if ($requestId <= 0) {
        zrr_json(['success' => false, 'msg' => 'requestId is required.'], 400);
    }

    $wpdb->query('START TRANSACTION');
    $request = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$table} WHERE id = %d FOR UPDATE",
        $requestId
    ), ARRAY_A);

    if (!$request) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'Request not found.'], 404);
    }
    if ($request['status'] === 'activated') {
        $wpdb->query('ROLLBACK');
        zrr_json([
            'success' => false,
            'msg' => 'This request has already been activated.',
            'expiresAt' => zrr_iso($request['expires_at']),
        ], 409);
    }
    if (in_array($request['status'], ['revoked', 'expired'], true)) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'This request is no longer usable.'], 409);
    }
    if (
        $request['status'] === 'issued'
        && $request['code_expires_at']
        && $request['code_expires_at'] > zrr_now()
    ) {
        $wpdb->query('ROLLBACK');
        zrr_json([
            'success' => false,
            'msg' => 'This licence is already issued. Use the resend command.',
        ], 409);
    }

    $code = zrr_generate_code();
    $issuedAt = zrr_now();
    $activateBefore = zrr_mysql_after(DAY_IN_SECONDS);
    $encryptedCode = function_exists('zrr_license_encrypt_code')
        ? zrr_license_encrypt_code($code)
        : '';
    $updated = $wpdb->update($table, [
        'license_code_hash' => hash('sha256', $code),
        'license_code_last4' => substr($code, -4),
        'license_code_ciphertext' => $encryptedCode,
        'status' => 'issued',
        'issued_at' => $issuedAt,
        'code_expires_at' => $activateBefore,
    ], ['id' => $requestId], ['%s', '%s', '%s', '%s', '%s', '%s'], ['%d']);

    if ($updated === false) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'Unable to issue license.'], 500);
    }
    $wpdb->query('COMMIT');

    $emailSent = function_exists('zrr_license_send_code_email')
        && zrr_license_send_code_email((string)$request['email'], $code, $activateBefore, $requestId);
    $wpdb->update($table, [
        'email_status' => $emailSent ? 'sent' : 'failed',
        'email_sent_at' => $emailSent ? zrr_now() : null,
    ], ['id' => $requestId], ['%s', '%s'], ['%d']);

    zrr_json([
        'success' => true,
        'requestId' => $requestId,
        'email' => $request['email'],
        'deviceId' => $request['request_device_id'],
        'licenseCode' => $code,
        'activateBefore' => zrr_iso($activateBefore),
        'validForSeconds' => DAY_IN_SECONDS,
        'emailSent' => $emailSent,
    ]);
}

if ($action === 'license_resend_admin') {
    zrr_require_admin();
    $requestId = (int)($_POST['requestId'] ?? 0);
    if ($requestId <= 0) {
        zrr_json(['success' => false, 'msg' => 'requestId is required.'], 400);
    }

    $request = $wpdb->get_row($wpdb->prepare(
        "SELECT email, status, code_expires_at, license_code_ciphertext
         FROM {$table}
         WHERE id = %d
         LIMIT 1",
        $requestId
    ), ARRAY_A);
    if (!$request || $request['status'] !== 'issued') {
        zrr_json(['success' => false, 'msg' => 'Issued license not found.'], 404);
    }
    if (!$request['code_expires_at'] || $request['code_expires_at'] <= zrr_now()) {
        zrr_json(['success' => false, 'msg' => 'Activation code expired.'], 410);
    }

    $code = function_exists('zrr_license_decrypt_code')
        ? zrr_license_decrypt_code((string)$request['license_code_ciphertext'])
        : '';
    if ($code === '') {
        zrr_json(['success' => false, 'msg' => 'Stored license code cannot be decrypted.'], 500);
    }

    $emailSent = function_exists('zrr_license_send_code_email')
        && zrr_license_send_code_email(
            (string)$request['email'],
            $code,
            (string)$request['code_expires_at'],
            $requestId
        );
    $wpdb->update($table, [
        'email_status' => $emailSent ? 'sent' : 'failed',
        'email_sent_at' => $emailSent ? zrr_now() : null,
    ], ['id' => $requestId], ['%s', '%s'], ['%d']);

    zrr_json([
        'success' => $emailSent,
        'requestId' => $requestId,
        'email' => $request['email'],
        'emailSent' => $emailSent,
    ], $emailSent ? 200 : 502);
}

if ($action === 'license_activate') {
    $email = zrr_email($_POST['email'] ?? '');
    $deviceId = zrr_device_id($_POST['deviceId'] ?? '');
    $code = zrr_license_code($_POST['licenseCode'] ?? '');

    if (!is_email($email) || strlen($deviceId) < 8 || strlen($code) < 20) {
        zrr_json(['success' => false, 'msg' => 'Email, installation ID, and license code are required.'], 400);
    }

    zrr_rate_limit('license_activate_ip:' . zrr_client_ip_hash(), 40, HOUR_IN_SECONDS);
    zrr_rate_limit('license_activate_identity:' . $email . ':' . $deviceId, 12, HOUR_IN_SECONDS);

    $codeHash = hash('sha256', $code);
    $wpdb->query('START TRANSACTION');
    $license = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$table}
         WHERE email = %s AND license_code_hash = %s
         LIMIT 1
         FOR UPDATE",
        $email,
        $codeHash
    ), ARRAY_A);

    if (!$license) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'License code not found for this email.'], 404);
    }
    $requestedDeviceId = (string)($license['request_device_id'] ?? '');
    $canClaimInstallation = $requestedDeviceId === '' && in_array($license['source'], ['armember', 'manual'], true);
    if (!$canClaimInstallation && !hash_equals($requestedDeviceId, $deviceId)) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'License code belongs to another installation.'], 409);
    }
    if ($license['status'] === 'activated') {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'License code has already been used.'], 409);
    }
    if ($license['status'] !== 'issued') {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'License code is not available for activation.'], 409);
    }
    if (!$license['code_expires_at'] || $license['code_expires_at'] <= zrr_now()) {
        $wpdb->update($table, ['status' => 'expired'], ['id' => (int)$license['id']], ['%s'], ['%d']);
        $wpdb->query('COMMIT');
        zrr_json(['success' => false, 'msg' => 'Activation code expired. Request a new code.'], 410);
    }

    $activatedAt = zrr_now();
    $preconfiguredExpiresAt = (string)($license['expires_at'] ?? '');
    $expiresAt = ($preconfiguredExpiresAt !== '' && $preconfiguredExpiresAt > zrr_now())
        ? $preconfiguredExpiresAt
        : zrr_mysql_after(DAY_IN_SECONDS);
    $validForSeconds = max(0, strtotime($expiresAt . ' UTC') - time());
    $updated = $wpdb->query($wpdb->prepare(
        "UPDATE {$table}
         SET status = 'activated',
             request_device_id = %s,
             activation_device_id = %s,
             activated_at = %s,
             expires_at = %s,
             license_code_ciphertext = NULL
         WHERE id = %d AND status = 'issued'",
        $deviceId,
        $deviceId,
        $activatedAt,
        $expiresAt,
        (int)$license['id']
    ));

    if ($updated !== 1) {
        $wpdb->query('ROLLBACK');
        zrr_json(['success' => false, 'msg' => 'License activation conflict. Please retry.'], 409);
    }
    $wpdb->query('COMMIT');

    zrr_json([
        'success' => true,
        'expiresAt' => zrr_iso($expiresAt),
        'activatedAt' => zrr_iso($activatedAt),
        'validForSeconds' => $validForSeconds,
    ]);
}

if ($action === 'license_status') {
    $email = zrr_email($_POST['email'] ?? '');
    $deviceId = zrr_device_id($_POST['deviceId'] ?? '');
    if (!is_email($email) || strlen($deviceId) < 8) {
        zrr_json(['success' => true, 'valid' => false]);
    }

    zrr_rate_limit('license_status_ip:' . zrr_client_ip_hash(), 180, HOUR_IN_SECONDS);
    $license = $wpdb->get_row($wpdb->prepare(
        "SELECT id, activated_at, expires_at
         FROM {$table}
         WHERE email = %s
           AND activation_device_id = %s
           AND status = 'activated'
         ORDER BY id DESC
         LIMIT 1",
        $email,
        $deviceId
    ), ARRAY_A);

    if (!$license || !$license['expires_at'] || $license['expires_at'] <= zrr_now()) {
        if ($license) {
            $wpdb->update($table, ['status' => 'expired'], ['id' => (int)$license['id']], ['%s'], ['%d']);
        }
        zrr_json(['success' => true, 'valid' => false]);
    }

    zrr_json([
        'success' => true,
        'valid' => true,
        'activatedAt' => zrr_iso($license['activated_at']),
        'expiresAt' => zrr_iso($license['expires_at']),
        'remainingSeconds' => max(0, strtotime($license['expires_at'] . ' UTC') - time()),
    ]);
}

if ($action === 'license_pending_admin') {
    zrr_require_admin();
    $rows = $wpdb->get_results(
        "SELECT id, email, request_device_id, license_code_last4, status,
                source, source_reference, email_status, email_sent_at, admin_notified_at,
                requested_at, issued_at, code_expires_at, activated_at, expires_at
         FROM {$table}
         ORDER BY id DESC
         LIMIT 50",
        ARRAY_A
    );
    foreach ($rows as &$row) {
        $row['id'] = (int)$row['id'];
        foreach ([
            'requested_at',
            'issued_at',
            'code_expires_at',
            'activated_at',
            'expires_at',
            'email_sent_at',
            'admin_notified_at',
        ] as $field) {
            $row[$field] = zrr_iso($row[$field]);
        }
    }
    unset($row);
    zrr_json(['success' => true, 'requests' => $rows]);
}

if ($action === 'license_revoke_admin') {
    zrr_require_admin();
    $requestId = (int)($_POST['requestId'] ?? 0);
    if ($requestId <= 0) {
        zrr_json(['success' => false, 'msg' => 'requestId is required.'], 400);
    }
    $updated = $wpdb->update($table, [
        'status' => 'revoked',
        'license_code_hash' => null,
        'license_code_ciphertext' => null,
        'revoked_at' => zrr_now(),
    ], ['id' => $requestId], ['%s', '%s', '%s', '%s'], ['%d']);
    if ($updated === false) {
        zrr_json(['success' => false, 'msg' => 'Unable to revoke license.'], 500);
    }
    zrr_json(['success' => true, 'requestId' => $requestId, 'revoked' => true]);
}

if ($action === 'auth') {
    $login = trim((string)($_POST['login'] ?? $_POST['email'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    if ($login === '' || $password === '') {
        zrr_json(['success' => false, 'msg' => 'Username or email and password are required.'], 400);
    }

    zrr_rate_limit('auth_ip:' . zrr_client_ip_hash(), 30, 15 * MINUTE_IN_SECONDS);
    $user = wp_authenticate($login, $password);
    if (is_wp_error($user) || !($user instanceof WP_User)) {
        zrr_json(['success' => false, 'msg' => 'Invalid username, email, or password.'], 401);
    }

    $token = bin2hex(random_bytes(32));
    update_user_meta($user->ID, 'zrr_extension_token_hash', hash('sha256', $token));
    update_user_meta($user->ID, 'zrr_extension_token_expires', time() + 30 * DAY_IN_SECONDS);
    zrr_json([
        'success' => true,
        'token' => $token,
        'email' => strtolower((string)$user->user_email),
        'membership' => zrr_membership_label($user),
    ]);
}

if ($action === 'zrr') {
    $token = trim((string)($_POST['token'] ?? ''));
    if ($token === '') {
        zrr_json(['success' => false, 'msg' => 'Missing token.'], 401);
    }

    $userIds = get_users([
        'meta_key' => 'zrr_extension_token_hash',
        'meta_value' => hash('sha256', $token),
        'fields' => 'ids',
        'number' => 1,
    ]);
    if (!$userIds) {
        zrr_json(['success' => false, 'msg' => 'Invalid token.'], 401);
    }
    $userId = (int)$userIds[0];
    if ((int)get_user_meta($userId, 'zrr_extension_token_expires', true) <= time()) {
        delete_user_meta($userId, 'zrr_extension_token_hash');
        delete_user_meta($userId, 'zrr_extension_token_expires');
        zrr_json(['success' => false, 'msg' => 'Token expired.'], 401);
    }

    $recent = $_POST['recentNumbers'] ?? [];
    if (is_string($recent)) {
        $recent = $recent === '' ? [] : explode(',', $recent);
    }
    $favorite = $_POST['favoriteNumbers'] ?? [];
    if (is_string($favorite)) {
        $favorite = $favorite === '' ? [] : explode(',', $favorite);
    }

    $betFavorites = array_slice((array)$recent, 0, 2);
    $betNumbers = array_values(array_unique(array_merge($betFavorites, array_slice((array)$favorite, 0, 2))));
    $highStakeNumbers = array_values(array_intersect((array)$recent, (array)$favorite));
    zrr_json([
        'success' => true,
        'betFavorites' => $betFavorites,
        'betNumbers' => $betNumbers,
        'highStakeNumbers' => $highStakeNumbers,
        'token' => $token,
    ]);
}

zrr_json(['success' => false, 'msg' => 'Invalid action.'], 400);
