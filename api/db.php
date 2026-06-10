<?php
declare(strict_types=1);

// Kept for compatibility with older deployments. The API now boots WordPress
// from index.php and uses the existing wpdb connection instead of credentials.
$wpLoad = dirname(__DIR__) . '/wp-load.php';
if (!is_file($wpLoad)) {
    throw new RuntimeException('WordPress bootstrap not found.');
}
require_once $wpLoad;
