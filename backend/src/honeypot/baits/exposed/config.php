<?php
// Configuration File - SecureApp v2.1.3

define('DB_HOST', 'db.internal.secureapp.com');
define('DB_NAME', 'secureapp_prod');
define('DB_USER', 'app_user');
define('DB_PASS', 'P@ssw0rd123!SecureDB');
define('DB_PREFIX', 'sa_');

define('SECRET_KEY', 'put your unique phrase here');
define('AUTH_KEY', 'put your unique phrase here');
define('SECURE_AUTH_KEY', 'put your unique phrase here');
define('LOGGED_IN_KEY', 'put your unique phrase here');

define('API_KEY', 'sk_live_abc123xyz789');
define('API_SECRET', 'secret_key_do_not_share_123');

define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_USER', 'noreply@secureapp.com');
define('SMTP_PASS', 'EmailP@ss789!');

define('DEBUG', false);
define('DISPLAY_ERRORS', false);

$allowed_ips = array(
    '192.168.1.0/24',
    '10.0.0.0/8',
    '203.0.113.42'
);
?>
