<?php
/**
 * Plugin Name: AAVenture Attendance Verification v2
 * Description: Attendance verification workflow with helper suggestions, upserted submissions, public masked verification, and admin review endpoints.
 * Version: 1.0.0
 * Author: AAVenture
 */

if (!defined('ABSPATH')) {
    exit;
}

class AAVenture_Attendance_V2 {
    const TABLE = 'aav_attendance_submissions';
    const PAGE_OPTION_KEYS = [
        'home' => 'aaventure_page_home_id',
        'attendance' => 'aaventure_page_attendance_id',
        'verify' => 'aaventure_page_verify_id',
        'meetings' => 'aaventure_page_meetings_id',
        'about' => 'aaventure_page_about_id'
    ];

    public static function init() {
        register_activation_hook(__FILE__, [__CLASS__, 'activate']);
        add_action('init', [__CLASS__, 'register_meeting_post_type']);
        add_action('init', [__CLASS__, 'register_meeting_meta']);
        add_action('admin_init', [__CLASS__, 'ensure_site_bootstrap']);
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('aaventure_attendance_send_email', [__CLASS__, 'send_submission_emails'], 10, 1);
        add_action('admin_menu', [__CLASS__, 'register_admin_menu']);
        add_shortcode('aaventure_attendance_form', [__CLASS__, 'render_shortcode']);
        add_shortcode('aaventure_verify_certificate', [__CLASS__, 'render_verify_shortcode']);
        add_shortcode('aaventure_home', [__CLASS__, 'render_home_shortcode']);
        add_shortcode('aaventure_meeting_catalog', [__CLASS__, 'render_meeting_catalog_shortcode']);
    }

    public static function activate() {
        global $wpdb;
        self::register_meeting_post_type();
        self::register_meeting_meta();
        $table = $wpdb->prefix . self::TABLE;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            meeting_id BIGINT UNSIGNED NULL,
            certificate_id VARCHAR(191) NULL,
            submission_key VARCHAR(255) NOT NULL,
            meeting_date DATE NOT NULL,
            meeting_time_label VARCHAR(40) NOT NULL,
            meeting_topic VARCHAR(200) NOT NULL,
            meeting_chairperson VARCHAR(120) NOT NULL,
            participation_notes TEXT NOT NULL,
            attendee_full_name VARCHAR(120) NOT NULL,
            attendee_email VARCHAR(255) NOT NULL,
            send_additional_recipient TINYINT(1) NOT NULL DEFAULT 0,
            additional_recipient_email VARCHAR(255) NULL,
            meeting_id_display VARCHAR(64) NOT NULL,
            check_in_at DATETIME NOT NULL,
            submitted_at DATETIME NOT NULL,
            revision INT NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'submitted',
            email_log LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY submission_key (submission_key),
            KEY user_submitted_idx (user_id, submitted_at),
            KEY cert_idx (certificate_id)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
        self::seed_site_pages();
        self::seed_default_meetings();
        flush_rewrite_rules();
    }

    private static function seed_site_pages() {
        $pages = [
            'home' => [
                'title' => 'AAVenture Home',
                'slug' => 'aaventure-home',
                'content' => '[aaventure_home]',
                'status' => 'publish'
            ],
            'attendance' => [
                'title' => 'Attendance Verification Form',
                'slug' => 'attendance-verification',
                'content' => '[aaventure_attendance_form]',
                'status' => 'publish'
            ],
            'verify' => [
                'title' => 'Certificate Verification',
                'slug' => 'certificate-verification',
                'content' => '[aaventure_verify_certificate]',
                'status' => 'publish'
            ],
            'meetings' => [
                'title' => 'Meetings',
                'slug' => 'meetings',
                'content' => '[aaventure_meeting_catalog]',
                'status' => 'publish'
            ],
            'about' => [
                'title' => 'About AAVenture',
                'slug' => 'about-aaventure',
                'content' => "AAVenture helps people document recovery participation and verify attendance quickly.\n\nUse the navigation links to submit attendance and verify certificates.",
                'status' => 'publish'
            ]
        ];

        foreach ($pages as $key => $page) {
            $existing_id = intval(get_option(self::PAGE_OPTION_KEYS[$key], 0));
            if ($existing_id > 0 && get_post_status($existing_id)) {
                continue;
            }

            $post = get_page_by_path($page['slug'], OBJECT, 'page');
            if ($post) {
                update_option(self::PAGE_OPTION_KEYS[$key], intval($post->ID));
                continue;
            }

            $id = wp_insert_post([
                'post_title' => $page['title'],
                'post_name' => $page['slug'],
                'post_type' => 'page',
                'post_status' => $page['status'],
                'post_content' => $page['content']
            ], true);
            if (!is_wp_error($id)) {
                update_option(self::PAGE_OPTION_KEYS[$key], intval($id));
            }
        }

        $home_id = intval(get_option(self::PAGE_OPTION_KEYS['home'], 0));
        if ($home_id > 0) {
            update_option('show_on_front', 'page');
            update_option('page_on_front', $home_id);
        }
    }

    public static function ensure_site_bootstrap() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $home_id = intval(get_option(self::PAGE_OPTION_KEYS['home'], 0));
        if ($home_id <= 0 || !get_post_status($home_id)) {
            self::seed_site_pages();
        }
        $home_page = get_page_by_path('aaventure-home', OBJECT, 'page');
        if ($home_page && intval($home_page->ID) > 0) {
            update_option(self::PAGE_OPTION_KEYS['home'], intval($home_page->ID));
            update_option('show_on_front', 'page');
            update_option('page_on_front', intval($home_page->ID));
        }
        $count = wp_count_posts('aav_meeting');
        if (!$count || intval($count->publish) === 0) {
            self::seed_default_meetings();
        }
    }

    public static function register_meeting_post_type() {
        register_post_type('aav_meeting', [
            'labels' => [
                'name' => 'Meetings',
                'singular_name' => 'Meeting'
            ],
            'public' => true,
            'show_in_rest' => true,
            'menu_icon' => 'dashicons-calendar-alt',
            'supports' => ['title', 'editor', 'excerpt'],
            'rewrite' => ['slug' => 'meeting']
        ]);
    }

    public static function register_meeting_meta() {
        $metas = [
            'aav_meeting_day' => 'string',
            'aav_meeting_time' => 'string',
            'aav_meeting_timezone' => 'string',
            'aav_meeting_chair' => 'string',
            'aav_meeting_join_url' => 'string',
            'aav_meeting_format' => 'string'
        ];
        foreach ($metas as $key => $type) {
            register_post_meta('aav_meeting', $key, [
                'single' => true,
                'show_in_rest' => true,
                'type' => $type,
                'sanitize_callback' => 'sanitize_text_field',
                'auth_callback' => function () {
                    return current_user_can('edit_posts');
                }
            ]);
        }
    }

    private static function seed_default_meetings() {
        $count = wp_count_posts('aav_meeting');
        if ($count && intval($count->publish) > 0) {
            return;
        }

        $defaults = [
            [
                'title' => 'Daily Reflection Group',
                'content' => 'Topic-focused open share meeting for daily recovery reflections.',
                'meta' => ['day' => 'Daily', 'time' => '7:00 PM', 'timezone' => 'EDT', 'chair' => 'Rotation Chair', 'join_url' => '#', 'format' => 'Open Discussion']
            ],
            [
                'title' => 'Step Study Meeting',
                'content' => 'Weekly structured step-study with speaker and open sharing.',
                'meta' => ['day' => 'Tuesday', 'time' => '8:30 PM', 'timezone' => 'EDT', 'chair' => 'Step Facilitator', 'join_url' => '#', 'format' => 'Step Study']
            ],
            [
                'title' => 'Newcomer Support',
                'content' => 'Beginner-friendly meeting covering fundamentals and newcomer Q&A.',
                'meta' => ['day' => 'Saturday', 'time' => '10:00 AM', 'timezone' => 'EDT', 'chair' => 'Host Team', 'join_url' => '#', 'format' => 'Newcomer']
            ]
        ];

        foreach ($defaults as $meeting) {
            $id = wp_insert_post([
                'post_title' => $meeting['title'],
                'post_content' => $meeting['content'],
                'post_status' => 'publish',
                'post_type' => 'aav_meeting'
            ], true);
            if (is_wp_error($id)) {
                continue;
            }
            update_post_meta($id, 'aav_meeting_day', $meeting['meta']['day']);
            update_post_meta($id, 'aav_meeting_time', $meeting['meta']['time']);
            update_post_meta($id, 'aav_meeting_timezone', $meeting['meta']['timezone']);
            update_post_meta($id, 'aav_meeting_chair', $meeting['meta']['chair']);
            update_post_meta($id, 'aav_meeting_join_url', $meeting['meta']['join_url']);
            update_post_meta($id, 'aav_meeting_format', $meeting['meta']['format']);
        }
    }

    private static function sanitize_text($value, $max = 255) {
        $sanitized = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags((string) $value)));
        return mb_substr($sanitized, 0, $max);
    }

    private static function is_valid_email($email) {
        return (bool) is_email($email);
    }

    private static function normalize_date($date_string) {
        $date_string = trim((string) $date_string);
        if ($date_string === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_string)) {
            return null;
        }
        $ts = strtotime($date_string . ' 00:00:00 UTC');
        return $ts ? gmdate('Y-m-d', $ts) : null;
    }

    private static function parse_check_in_at($meeting_date, $meeting_time_label) {
        $ts = strtotime("{$meeting_date} {$meeting_time_label}");
        if (!$ts) {
            $ts = strtotime("{$meeting_date} 12:00:00 UTC");
        }
        return $ts ? gmdate('Y-m-d H:i:s', $ts) : gmdate('Y-m-d H:i:s');
    }

    private static function build_submission_key($user_id, $meeting_date, $meeting_time, $meeting_topic) {
        $topic = strtolower(self::sanitize_text($meeting_topic, 200));
        $time = self::sanitize_text($meeting_time, 40);
        return "{$user_id}:{$meeting_date}:{$time}:{$topic}";
    }

    private static function mask_name($name) {
        $name = self::sanitize_text($name, 120);
        if ($name === '') {
            return 'Unknown';
        }
        $parts = array_filter(explode(' ', $name));
        $masked = array_map(function ($part) {
            $first = mb_substr($part, 0, 1);
            return strtoupper($first) . '***';
        }, $parts);
        return implode(' ', $masked);
    }

    private static function build_meeting_id_display($user_id, $iso_day) {
        $seed = $user_id . ':' . $iso_day . ':' . wp_salt('auth');
        return substr(str_replace(['+', '/', '='], '', base64_encode(hash('sha256', $seed, true))), 0, 24);
    }

    private static function get_table() {
        global $wpdb;
        return $wpdb->prefix . self::TABLE;
    }

    private static function helper_rate_limited($user_id) {
        $key = 'aav_helper_rl_' . intval($user_id);
        $hits = intval(get_transient($key));
        if ($hits >= 10) {
            return true;
        }
        set_transient($key, $hits + 1, MINUTE_IN_SECONDS);
        return false;
    }

    private static function should_require_subscription() {
        if (defined('AAVENTURE_WP_REQUIRE_SUBSCRIPTION') && AAVENTURE_WP_REQUIRE_SUBSCRIPTION) {
            return true;
        }
        return false;
    }

    private static function has_active_subscription($user_id) {
        $default = true;
        return (bool) apply_filters('aaventure_attendance_user_has_active_subscription', $default, $user_id);
    }

    private static function get_node_sync_url() {
        $from_const = defined('AAVENTURE_NODE_SYNC_URL') ? AAVENTURE_NODE_SYNC_URL : '';
        $from_env = getenv('AAVENTURE_NODE_SYNC_URL') ?: '';
        $url = trim((string) ($from_const ?: $from_env));
        return rtrim($url, '/');
    }

    private static function get_sync_token() {
        $from_const = defined('AAVENTURE_SYNC_TOKEN') ? AAVENTURE_SYNC_TOKEN : '';
        $from_env = getenv('AAVENTURE_SYNC_TOKEN') ?: '';
        return trim((string) ($from_const ?: $from_env));
    }

    private static function sync_submission_to_node($submission_id) {
        global $wpdb;
        $sync_url_base = self::get_node_sync_url();
        if ($sync_url_base === '') {
            return;
        }

        $table = self::get_table();
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", intval($submission_id)), ARRAY_A);
        if (!$row) {
            return;
        }

        $endpoint = $sync_url_base . '/api/attendance/wordpress-sync-submission';
        $body = [
            'wpSubmissionId' => strval($row['id']),
            'fullName' => (string) $row['attendee_full_name'],
            'email' => (string) $row['attendee_email'],
            'meetingDate' => (string) $row['meeting_date'],
            'meetingTime' => (string) $row['meeting_time_label'],
            'meetingTopic' => (string) $row['meeting_topic'],
            'meetingChairperson' => (string) $row['meeting_chairperson'],
            'participationInfo' => (string) $row['participation_notes'],
            'sendAdditionalRecipient' => intval($row['send_additional_recipient']) === 1 ? 'yes' : 'no',
            'additionalRecipientEmail' => (string) ($row['additional_recipient_email'] ?: ''),
            'meetingIdDisplay' => (string) $row['meeting_id_display'],
            'certificateId' => (string) ($row['certificate_id'] ?: '')
        ];

        $headers = ['Content-Type' => 'application/json'];
        $token = self::get_sync_token();
        if ($token !== '') {
            $headers['x-aav-sync-token'] = $token;
        }

        $response = wp_remote_post($endpoint, [
            'timeout' => 8,
            'headers' => $headers,
            'body' => wp_json_encode($body)
        ]);
        if (is_wp_error($response)) {
            error_log('AAVenture sync to Node failed: ' . $response->get_error_message());
            return;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            error_log('AAVenture sync to Node failed with status ' . $status);
            return;
        }

        $payload = json_decode((string) wp_remote_retrieve_body($response), true);
        if (!is_array($payload)) {
            return;
        }
        if (!empty($payload['canonicalCertificateId']) && empty($row['certificate_id'])) {
            $wpdb->update($table, [
                'certificate_id' => self::sanitize_text($payload['canonicalCertificateId'], 191),
                'status' => 'linked',
                'updated_at' => current_time('mysql', 1)
            ], ['id' => intval($submission_id)]);
        }
    }

    private static function build_certificate_id($user_id, $submission_key) {
        $seed = $user_id . ':' . $submission_key . ':' . wp_salt('secure_auth');
        return 'AAV-' . strtoupper(substr(hash('sha256', $seed), 0, 14));
    }

    public static function register_admin_menu() {
        add_menu_page(
            'Attendance Submissions',
            'Attendance Submissions',
            'manage_options',
            'aaventure-attendance-submissions',
            [__CLASS__, 'render_admin_page'],
            'dashicons-yes-alt',
            26
        );
    }

    public static function register_routes() {
        register_rest_route('aaventure/v1', '/verification-form-metadata', [
            'methods' => 'GET',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => [__CLASS__, 'metadata']
        ]);

        register_rest_route('aaventure/v1', '/helper-suggest', [
            'methods' => 'POST',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => [__CLASS__, 'helper_suggest']
        ]);

        register_rest_route('aaventure/v1', '/submit-verification-form', [
            'methods' => 'POST',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => [__CLASS__, 'submit_form']
        ]);

        register_rest_route('aaventure/v1', '/verify/(?P<certificate_id>[a-zA-Z0-9_-]+)', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [__CLASS__, 'verify_certificate']
        ]);

        register_rest_route('aaventure/v1', '/admin/attendance-submissions', [
            'methods' => 'GET',
            'permission_callback' => function () {
                return current_user_can('manage_options');
            },
            'callback' => [__CLASS__, 'admin_list']
        ]);

        register_rest_route('aaventure/v1', '/admin/attendance-submissions/(?P<id>\d+)', [
            'methods' => 'GET',
            'permission_callback' => function () {
                return current_user_can('manage_options');
            },
            'callback' => [__CLASS__, 'admin_detail']
        ]);

        register_rest_route('aaventure/v1', '/admin/attendance-submissions/(?P<id>\d+)/retry-email', [
            'methods' => 'POST',
            'permission_callback' => function () {
                return current_user_can('manage_options');
            },
            'callback' => [__CLASS__, 'admin_retry_email']
        ]);
    }

    public static function metadata() {
        $user_id = get_current_user_id();
        $iso_day = gmdate('Y-m-d');
        $token = self::build_meeting_id_display($user_id, $iso_day);
        update_user_meta($user_id, '_aav_attendance_meeting_token', $token);
        update_user_meta($user_id, '_aav_attendance_meeting_token_day', $iso_day);
        update_user_meta($user_id, '_aav_attendance_check_in_at', gmdate('c'));

        return new WP_REST_Response([
            'success' => true,
            'meetingIdDisplay' => $token,
            'checkInAt' => get_user_meta($user_id, '_aav_attendance_check_in_at', true)
        ], 200);
    }

    public static function helper_suggest(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        if (self::helper_rate_limited($user_id)) {
            return new WP_REST_Response(['error' => 'Attendance helper is receiving high traffic. Please try again shortly.'], 429);
        }

        $topic = self::sanitize_text($request->get_param('meetingTopic'), 200);
        $chair = self::sanitize_text($request->get_param('meetingChairperson'), 120);
        $notes = self::sanitize_text($request->get_param('participationInfo'), 1000);

        $warnings = [];
        $topic_lc = strtolower($topic);
        if ($topic_lc === '' || in_array($topic_lc, ['meeting', 'aa meeting', 'na meeting', 'open meeting'], true)) {
            $warnings[] = 'Meeting topic looks generic. Use the specific session topic discussed.';
        }
        if (mb_strlen($notes) < 12) {
            $warnings[] = 'Participation notes are brief. Add one sentence about how you participated.';
        }

        return new WP_REST_Response([
            'success' => true,
            'meetingTopicSuggestion' => $topic ? $topic . ' - Experience, Strength, and Hope' : 'Step-focused discussion: Applying recovery principles in daily life',
            'participationInfoSuggestion' => $notes ? $notes . ' I listened actively and reflected on how the discussion applies to my recovery.' : 'I listened attentively, related to shared experiences, and reflected on practical recovery steps for today.',
            'chairpersonPromptHint' => $chair ? 'Confirm spelling for chairperson name: ' . $chair . '.' : 'Include the full name of the chairperson leading this session.',
            'qualityWarnings' => $warnings,
            'disclaimer' => 'Suggestions are drafts only. Review and edit before submitting.'
        ], 200);
    }

    public static function submit_form(WP_REST_Request $request) {
        global $wpdb;

        $user_id = get_current_user_id();
        if (self::should_require_subscription() && !self::has_active_subscription($user_id)) {
            return new WP_REST_Response([
                'error' => 'Active subscription required',
                'message' => 'Please subscribe to access proof of attendance features'
            ], 403);
        }

        $payload = [
            'meetingDate' => self::sanitize_text($request->get_param('meetingDate'), 10),
            'meetingTime' => self::sanitize_text($request->get_param('meetingTime'), 40),
            'meetingTopic' => self::sanitize_text($request->get_param('meetingTopic'), 200),
            'meetingChairperson' => self::sanitize_text($request->get_param('meetingChairperson'), 120),
            'participationInfo' => self::sanitize_text($request->get_param('participationInfo'), 1000),
            'fullName' => self::sanitize_text($request->get_param('fullName'), 120),
            'email' => strtolower(self::sanitize_text($request->get_param('email'), 255)),
            'sendAdditionalRecipient' => strtolower(self::sanitize_text($request->get_param('sendAdditionalRecipient'), 10)),
            'additionalRecipientEmail' => strtolower(self::sanitize_text($request->get_param('additionalRecipientEmail'), 255)),
            'meetingIdDisplay' => self::sanitize_text($request->get_param('meetingIdDisplay'), 64)
        ];

        $errors = [];
        if ($payload['fullName'] === '') { $errors['attendeeFullName'] = 'The field is required.'; }
        if (!self::is_valid_email($payload['email'])) { $errors['attendeeEmail'] = 'The field is required.'; }
        if ($payload['sendAdditionalRecipient'] === '') { $errors['extraRecipientChoice'] = 'The field is required.'; }
        if ($payload['meetingDate'] === '') { $errors['meetingDateInput'] = 'The field is required.'; }
        if ($payload['meetingTime'] === '') { $errors['meetingTimeInput'] = 'The field is required.'; }
        if ($payload['meetingTopic'] === '') { $errors['meetingTopicInput'] = 'The field is required.'; }
        if ($payload['meetingChairperson'] === '') { $errors['meetingChairpersonInput'] = 'The field is required.'; }
        if ($payload['participationInfo'] === '') { $errors['participationInfoInput'] = 'The field is required.'; }

        $extra_enabled = in_array($payload['sendAdditionalRecipient'], ['yes', 'true'], true);
        if ($extra_enabled && !self::is_valid_email($payload['additionalRecipientEmail'])) {
            $errors['extraRecipientEmail'] = 'The field is required.';
        }

        if (!empty($errors)) {
            return new WP_REST_Response([
                'error' => 'One or more fields have an error. Please check and try again.',
                'validationErrors' => $errors
            ], 400);
        }

        $normalized_date = self::normalize_date($payload['meetingDate']);
        if (!$normalized_date) {
            return new WP_REST_Response([
                'error' => 'One or more fields have an error. Please check and try again.',
                'validationErrors' => [ 'meetingDateInput' => 'The field is required.' ]
            ], 400);
        }

        $expected_token = get_user_meta($user_id, '_aav_attendance_meeting_token', true);
        if (!$expected_token || $expected_token !== $payload['meetingIdDisplay']) {
            return new WP_REST_Response([
                'error' => 'Meeting ID validation failed. Refresh the page and try again.'
            ], 400);
        }

        $submission_key = self::build_submission_key($user_id, $normalized_date, $payload['meetingTime'], $payload['meetingTopic']);
        $table = self::get_table();
        $now = current_time('mysql', 1);
        $check_in_at = self::parse_check_in_at($normalized_date, $payload['meetingTime']);

        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE submission_key = %s LIMIT 1",
            $submission_key
        ));

        if ($existing) {
            $revision = intval($existing->revision) + 1;
            $certificate_id = !empty($existing->certificate_id)
                ? (string) $existing->certificate_id
                : self::build_certificate_id($user_id, $submission_key);
            $next_status = !empty($certificate_id) ? 'linked' : (($existing->status === 'error') ? 'submitted' : $existing->status);
            $wpdb->update($table, [
                'meeting_date' => $normalized_date,
                'meeting_time_label' => $payload['meetingTime'],
                'meeting_topic' => $payload['meetingTopic'],
                'meeting_chairperson' => $payload['meetingChairperson'],
                'participation_notes' => $payload['participationInfo'],
                'attendee_full_name' => $payload['fullName'],
                'attendee_email' => $payload['email'],
                'send_additional_recipient' => $extra_enabled ? 1 : 0,
                'additional_recipient_email' => $extra_enabled ? $payload['additionalRecipientEmail'] : null,
                'meeting_id_display' => $payload['meetingIdDisplay'],
                'check_in_at' => $check_in_at,
                'submitted_at' => $now,
                'revision' => $revision,
                'certificate_id' => $certificate_id,
                'status' => $next_status,
                'updated_at' => $now
            ], ['id' => intval($existing->id)]);
            $submission_id = intval($existing->id);
            $linked_certificate_id = $certificate_id;
        } else {
            $certificate_id = self::build_certificate_id($user_id, $submission_key);
            $wpdb->insert($table, [
                'user_id' => $user_id,
                'meeting_id' => null,
                'certificate_id' => $certificate_id,
                'submission_key' => $submission_key,
                'meeting_date' => $normalized_date,
                'meeting_time_label' => $payload['meetingTime'],
                'meeting_topic' => $payload['meetingTopic'],
                'meeting_chairperson' => $payload['meetingChairperson'],
                'participation_notes' => $payload['participationInfo'],
                'attendee_full_name' => $payload['fullName'],
                'attendee_email' => $payload['email'],
                'send_additional_recipient' => $extra_enabled ? 1 : 0,
                'additional_recipient_email' => $extra_enabled ? $payload['additionalRecipientEmail'] : null,
                'meeting_id_display' => $payload['meetingIdDisplay'],
                'check_in_at' => $check_in_at,
                'submitted_at' => $now,
                'revision' => 1,
                'status' => 'linked',
                'email_log' => wp_json_encode([]),
                'created_at' => $now,
                'updated_at' => $now
            ]);
            $submission_id = intval($wpdb->insert_id);
            $revision = 1;
            $linked_certificate_id = $certificate_id;
        }

        wp_schedule_single_event(time() + 3, 'aaventure_attendance_send_email', [$submission_id]);
        self::sync_submission_to_node($submission_id);

        return new WP_REST_Response([
            'success' => true,
            'submissionId' => $submission_id,
            'revision' => $revision,
            'linkedCertificateId' => $linked_certificate_id,
            'message' => 'Attendance form submitted successfully.'
        ], 200);
    }

    public static function send_submission_emails($submission_id) {
        global $wpdb;
        $table = self::get_table();
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", intval($submission_id)));
        if (!$row) {
            return;
        }

        $recipients = [[
            'email' => $row->attendee_email,
            'type' => 'attendee'
        ]];
        if (intval($row->send_additional_recipient) === 1 && !empty($row->additional_recipient_email)) {
            $recipients[] = [
                'email' => $row->additional_recipient_email,
                'type' => 'additional'
            ];
        }

        $logs = json_decode((string) $row->email_log, true);
        if (!is_array($logs)) {
            $logs = [];
        }

        $has_attendee_success = false;
        $had_failure = false;

        foreach ($recipients as $recipient) {
            $subject = 'Attendance Submission Confirmation';
            $body = "Your attendance submission was received.\n\nMeeting Topic: {$row->meeting_topic}\nMeeting Date: {$row->meeting_date}\nMeeting Time: {$row->meeting_time_label}\nMeeting ID: {$row->meeting_id_display}";
            $sent = wp_mail($recipient['email'], $subject, $body);

            if ($recipient['type'] === 'attendee' && $sent) {
                $has_attendee_success = true;
            }
            if (!$sent) {
                $had_failure = true;
            }

            $logs[] = [
                'recipient' => $recipient['email'],
                'type' => $recipient['type'],
                'sentAt' => gmdate('c'),
                'providerMessageId' => null,
                'success' => (bool) $sent,
                'error' => $sent ? null : 'Failed to send'
            ];
        }

        $next_status = $row->status;
        if ($has_attendee_success) {
            $next_status = 'emailed';
        } elseif ($had_failure) {
            $next_status = 'error';
        }

        $wpdb->update($table, [
            'status' => $next_status,
            'email_log' => wp_json_encode($logs),
            'updated_at' => current_time('mysql', 1)
        ], ['id' => intval($row->id)]);
    }

    public static function verify_certificate(WP_REST_Request $request) {
        global $wpdb;
        $table = self::get_table();
        $certificate_id = self::sanitize_text($request['certificate_id'], 191);
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE certificate_id = %s LIMIT 1",
            $certificate_id
        ));

        if (!$row) {
            return new WP_REST_Response(['error' => 'Certificate not found'], 404);
        }

        return new WP_REST_Response([
            'success' => true,
            'verified' => true,
            'certificate' => [
                'id' => $row->certificate_id,
                'attendeeNameMasked' => self::mask_name($row->attendee_full_name),
                'meetingTitle' => $row->meeting_topic,
                'meetingType' => 'Meeting',
                'date' => $row->meeting_date,
                'duration' => null,
                'verified' => true
            ]
        ], 200);
    }

    public static function admin_list(WP_REST_Request $request) {
        global $wpdb;
        $table = self::get_table();

        $limit = min(100, max(1, intval($request->get_param('limit') ?: 25)));
        $page = max(1, intval($request->get_param('page') ?: 1));
        $offset = ($page - 1) * $limit;
        $status = self::sanitize_text($request->get_param('status'), 20);
        $search = self::sanitize_text($request->get_param('search'), 120);
        $date_from = self::normalize_date($request->get_param('dateFrom'));
        $date_to = self::normalize_date($request->get_param('dateTo'));

        $where = '1=1';
        $args = [];
        if ($status !== '') {
            $where .= ' AND status = %s';
            $args[] = $status;
        }
        if ($search !== '') {
            $where .= ' AND (attendee_full_name LIKE %s OR attendee_email LIKE %s OR meeting_topic LIKE %s OR certificate_id LIKE %s)';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $args[] = $like;
            $args[] = $like;
            $args[] = $like;
            $args[] = $like;
        }
        if ($date_from) {
            $where .= ' AND meeting_date >= %s';
            $args[] = $date_from;
        }
        if ($date_to) {
            $where .= ' AND meeting_date <= %s';
            $args[] = $date_to;
        }

        $query = "SELECT * FROM {$table} WHERE {$where} ORDER BY submitted_at DESC LIMIT %d OFFSET %d";
        $args[] = $limit;
        $args[] = $offset;
        $records = $wpdb->get_results($wpdb->prepare($query, $args), ARRAY_A);

        $count_query = "SELECT COUNT(*) FROM {$table} WHERE {$where}";
        $count_args = $args;
        array_pop($count_args);
        array_pop($count_args);
        $total = intval(!empty($count_args) ? $wpdb->get_var($wpdb->prepare($count_query, $count_args)) : $wpdb->get_var($count_query));

        return new WP_REST_Response([
            'success' => true,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'records' => $records
        ], 200);
    }

    public static function admin_detail(WP_REST_Request $request) {
        global $wpdb;
        $table = self::get_table();
        $id = intval($request['id']);
        $record = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", $id), ARRAY_A);
        if (!$record) {
            return new WP_REST_Response(['error' => 'Submission not found'], 404);
        }
        return new WP_REST_Response(['success' => true, 'record' => $record, 'linkedAttendance' => null], 200);
    }

    public static function admin_retry_email(WP_REST_Request $request) {
        global $wpdb;
        $table = self::get_table();
        $id = intval($request['id']);
        $row = $wpdb->get_row($wpdb->prepare("SELECT id, certificate_id FROM {$table} WHERE id = %d LIMIT 1", $id));
        if (!$row) {
            return new WP_REST_Response(['error' => 'Submission not found'], 404);
        }

        $next_status = !empty($row->certificate_id) ? 'linked' : 'submitted';
        $wpdb->update($table, [
            'status' => $next_status,
            'updated_at' => current_time('mysql', 1)
        ], ['id' => $id]);

        wp_schedule_single_event(time() + 3, 'aaventure_attendance_send_email', [$id]);

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Email retry queued'
        ], 200);
    }

    public static function render_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        global $wpdb;
        $table = self::get_table();
        $notice = '';
        $error = '';

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['aav_action'])) {
            $nonce_ok = isset($_POST['aav_nonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['aav_nonce'])), 'aav_admin_action');
            if (!$nonce_ok) {
                $error = 'Invalid security token.';
            } else {
                $submission_id = isset($_POST['submission_id']) ? intval($_POST['submission_id']) : 0;
                if ($_POST['aav_action'] === 'retry_email' && $submission_id > 0) {
                    $row = $wpdb->get_row($wpdb->prepare("SELECT certificate_id FROM {$table} WHERE id = %d", $submission_id));
                    $next_status = (!empty($row) && !empty($row->certificate_id)) ? 'linked' : 'submitted';
                    $wpdb->update($table, [
                        'status' => $next_status,
                        'updated_at' => current_time('mysql', 1)
                    ], ['id' => $submission_id]);
                    wp_schedule_single_event(time() + 3, 'aaventure_attendance_send_email', [$submission_id]);
                    $notice = 'Email retry queued.';
                }
                if ($_POST['aav_action'] === 'set_certificate' && $submission_id > 0) {
                    $certificate_id = self::sanitize_text(isset($_POST['certificate_id']) ? wp_unslash($_POST['certificate_id']) : '', 191);
                    if ($certificate_id === '') {
                        $error = 'Certificate ID is required.';
                    } else {
                        $wpdb->update($table, [
                            'certificate_id' => $certificate_id,
                            'status' => 'linked',
                            'updated_at' => current_time('mysql', 1)
                        ], ['id' => $submission_id]);
                        self::sync_submission_to_node($submission_id);
                        $notice = 'Certificate ID updated.';
                    }
                }
            }
        }

        $status = self::sanitize_text(isset($_GET['status']) ? wp_unslash($_GET['status']) : '', 20);
        $search = self::sanitize_text(isset($_GET['s']) ? wp_unslash($_GET['s']) : '', 120);
        $where = '1=1';
        $args = [];
        if ($status !== '') {
            $where .= ' AND status = %s';
            $args[] = $status;
        }
        if ($search !== '') {
            $where .= ' AND (attendee_full_name LIKE %s OR attendee_email LIKE %s OR meeting_topic LIKE %s OR certificate_id LIKE %s)';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $args[] = $like;
            $args[] = $like;
            $args[] = $like;
            $args[] = $like;
        }
        $query = "SELECT * FROM {$table} WHERE {$where} ORDER BY submitted_at DESC LIMIT 200";
        $rows = !empty($args) ? $wpdb->get_results($wpdb->prepare($query, $args)) : $wpdb->get_results($query);
        ?>
        <div class="wrap">
            <h1>Attendance Submissions</h1>
            <?php if ($notice !== ''): ?>
                <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
            <?php endif; ?>
            <?php if ($error !== ''): ?>
                <div class="notice notice-error"><p><?php echo esc_html($error); ?></p></div>
            <?php endif; ?>

            <form method="get" action="">
                <input type="hidden" name="page" value="aaventure-attendance-submissions" />
                <input type="text" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Search name/email/topic/certificate" />
                <select name="status">
                    <option value="">All statuses</option>
                    <?php foreach (['submitted', 'linked', 'emailed', 'error'] as $status_opt): ?>
                        <option value="<?php echo esc_attr($status_opt); ?>" <?php selected($status, $status_opt); ?>><?php echo esc_html($status_opt); ?></option>
                    <?php endforeach; ?>
                </select>
                <button class="button">Filter</button>
            </form>

            <table class="widefat striped" style="margin-top:12px;">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Submitted At (UTC)</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Topic</th>
                        <th>Certificate</th>
                        <th>Status</th>
                        <th>Revision</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($rows)): ?>
                        <tr><td colspan="9">No submissions found.</td></tr>
                    <?php else: ?>
                        <?php foreach ($rows as $row): ?>
                            <tr>
                                <td><?php echo intval($row->id); ?></td>
                                <td><?php echo esc_html((string) $row->submitted_at); ?></td>
                                <td><?php echo esc_html((string) $row->attendee_full_name); ?></td>
                                <td><?php echo esc_html((string) $row->attendee_email); ?></td>
                                <td><?php echo esc_html((string) $row->meeting_topic); ?></td>
                                <td><?php echo esc_html((string) $row->certificate_id); ?></td>
                                <td><?php echo esc_html((string) $row->status); ?></td>
                                <td><?php echo intval($row->revision); ?></td>
                                <td>
                                    <form method="post" style="display:inline-block; margin-right:8px;">
                                        <?php wp_nonce_field('aav_admin_action', 'aav_nonce'); ?>
                                        <input type="hidden" name="aav_action" value="retry_email" />
                                        <input type="hidden" name="submission_id" value="<?php echo intval($row->id); ?>" />
                                        <button class="button">Retry Email</button>
                                    </form>
                                    <form method="post" style="display:inline-block;">
                                        <?php wp_nonce_field('aav_admin_action', 'aav_nonce'); ?>
                                        <input type="hidden" name="aav_action" value="set_certificate" />
                                        <input type="hidden" name="submission_id" value="<?php echo intval($row->id); ?>" />
                                        <input type="text" name="certificate_id" value="<?php echo esc_attr((string) $row->certificate_id); ?>" placeholder="Certificate ID" />
                                        <button class="button button-secondary">Save Cert</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    public static function render_verify_shortcode() {
        $rest_base = esc_url_raw(rest_url('aaventure/v1'));
        ob_start();
        ?>
        <div id="aaventure-verify-widget" style="max-width:760px; border:1px solid #d9d9d9; border-radius:8px; padding:16px;">
            <h3>Verify Certificate</h3>
            <label for="aav-cert-id">Certificate ID</label>
            <input id="aav-cert-id" style="width:100%; max-width:360px;" placeholder="AAV-XXXXXXXXXXXXXX" />
            <button type="button" id="aav-cert-verify-btn">Verify</button>
            <div id="aav-cert-result" aria-live="polite" style="margin-top:10px;"></div>
        </div>
        <script>
        (function () {
            const base = <?php echo wp_json_encode($rest_base); ?>;
            const input = document.getElementById('aav-cert-id');
            const btn = document.getElementById('aav-cert-verify-btn');
            const result = document.getElementById('aav-cert-result');
            if (!input || !btn || !result) return;
            btn.addEventListener('click', async function () {
                result.textContent = '';
                const cert = input.value.trim();
                if (!cert) {
                    result.textContent = 'Certificate ID is required.';
                    return;
                }
                try {
                    const res = await fetch(base + '/verify/' + encodeURIComponent(cert), { method: 'GET' });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.error || 'Not found');
                    const c = data.certificate || {};
                    result.innerHTML = '<strong>Verified</strong><br>' +
                        'Name: ' + (c.attendeeNameMasked || 'N/A') + '<br>' +
                        'Meeting: ' + (c.meetingTitle || 'N/A') + '<br>' +
                        'Date: ' + (c.date || 'N/A') + '<br>' +
                        'Certificate ID: ' + (c.id || cert);
                } catch (e) {
                    result.textContent = 'Verification failed: ' + e.message;
                }
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }

    public static function render_home_shortcode() {
        $attendance_url = get_permalink(intval(get_option(self::PAGE_OPTION_KEYS['attendance'], 0)));
        $verify_url = get_permalink(intval(get_option(self::PAGE_OPTION_KEYS['verify'], 0)));
        $meetings_url = get_permalink(intval(get_option(self::PAGE_OPTION_KEYS['meetings'], 0)));
        $about_url = get_permalink(intval(get_option(self::PAGE_OPTION_KEYS['about'], 0)));

        ob_start();
        ?>
        <section style="max-width:980px; margin:0 auto; padding:20px; border:1px solid #dadada; border-radius:10px;">
            <h2 style="margin-top:0;">AAVenture Recovery Platform</h2>
            <p>Join meetings, submit attendance proof, and verify certificates in one workflow.</p>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
                <a href="<?php echo esc_url($attendance_url ?: '#'); ?>" style="padding:10px 14px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:6px;">Submit Attendance</a>
                <a href="<?php echo esc_url($verify_url ?: '#'); ?>" style="padding:10px 14px; background:#1f7a4d; color:#fff; text-decoration:none; border-radius:6px;">Verify Certificate</a>
                <a href="<?php echo esc_url($meetings_url ?: '#'); ?>" style="padding:10px 14px; background:#4a5568; color:#fff; text-decoration:none; border-radius:6px;">View Meetings</a>
                <a href="<?php echo esc_url($about_url ?: '#'); ?>" style="padding:10px 14px; background:#6b7280; color:#fff; text-decoration:none; border-radius:6px;">About</a>
            </div>
            <hr style="margin:18px 0;" />
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px;">
                <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
                    <h3 style="margin-top:0;">Attendance Proof</h3>
                    <p>Capture check-in data and submit verified meeting participation records.</p>
                </div>
                <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
                    <h3 style="margin-top:0;">Certificate Verification</h3>
                    <p>Use public-safe verification with masked attendee identity output.</p>
                </div>
                <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
                    <h3 style="margin-top:0;">Admin Operations</h3>
                    <p>Review submissions, retry email notifications, and manage certificate links.</p>
                </div>
            </div>
        </section>
        <?php
        return ob_get_clean();
    }

    public static function render_meeting_catalog_shortcode() {
        $query = new WP_Query([
            'post_type' => 'aav_meeting',
            'post_status' => 'publish',
            'posts_per_page' => 50,
            'orderby' => 'date',
            'order' => 'DESC'
        ]);

        ob_start();
        ?>
        <section style="max-width:980px; margin:0 auto;">
            <h2>Meetings</h2>
            <p>Schedule and meeting links managed in WordPress.</p>
            <?php if (!$query->have_posts()): ?>
                <p>No meetings published yet.</p>
            <?php else: ?>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px;">
                    <?php while ($query->have_posts()): $query->the_post(); ?>
                        <?php
                        $id = get_the_ID();
                        $day = get_post_meta($id, 'aav_meeting_day', true);
                        $time = get_post_meta($id, 'aav_meeting_time', true);
                        $timezone = get_post_meta($id, 'aav_meeting_timezone', true);
                        $chair = get_post_meta($id, 'aav_meeting_chair', true);
                        $join = get_post_meta($id, 'aav_meeting_join_url', true);
                        $format = get_post_meta($id, 'aav_meeting_format', true);
                        ?>
                        <article style="border:1px solid #d9d9d9; border-radius:8px; padding:12px;">
                            <h3 style="margin-top:0;"><?php the_title(); ?></h3>
                            <p style="margin:0 0 6px;"><strong>Format:</strong> <?php echo esc_html((string) $format); ?></p>
                            <p style="margin:0 0 6px;"><strong>When:</strong> <?php echo esc_html(trim((string) $day . ' ' . (string) $time . ' ' . (string) $timezone)); ?></p>
                            <p style="margin:0 0 6px;"><strong>Chair:</strong> <?php echo esc_html((string) $chair); ?></p>
                            <div style="margin:8px 0;"><?php the_excerpt(); ?></div>
                            <?php if (!empty($join) && $join !== '#'): ?>
                                <a href="<?php echo esc_url($join); ?>" target="_blank" rel="noopener" style="display:inline-block; margin-top:6px;">Join Meeting</a>
                            <?php endif; ?>
                        </article>
                    <?php endwhile; ?>
                </div>
            <?php endif; ?>
        </section>
        <?php
        wp_reset_postdata();
        return ob_get_clean();
    }

    public static function render_shortcode() {
        if (!is_user_logged_in()) {
            return '<p>Please log in to access the attendance form.</p>';
        }

        $rest_base = esc_url_raw(rest_url('aaventure/v1'));
        $nonce = wp_create_nonce('wp_rest');
        ob_start();
        ?>
        <div id="aaventure-attendance-v2">
            <style>
                #aaventure-attendance-v2 { max-width: 820px; border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; }
                #aaventure-attendance-v2 .aav-label { display: block; margin-top: 12px; font-weight: 600; }
                #aaventure-attendance-v2 .aav-input,
                #aaventure-attendance-v2 .aav-select,
                #aaventure-attendance-v2 .aav-textarea { width: 100%; box-sizing: border-box; }
                #aaventure-attendance-v2 .aav-textarea { min-height: 110px; }
                #aaventure-attendance-v2 .aav-hint { color: #555; margin: 4px 0 8px; }
                #aaventure-attendance-v2 .aav-field-error { color: #a10000; margin: 4px 0 0; display: none; }
                #aaventure-attendance-v2 .aav-global { background: #fde8e8; border: 1px solid #f2b2b2; color: #8a0000; padding: 10px; margin: 10px 0; display: none; }
                #aaventure-attendance-v2 .aav-success { background: #ecfdf3; border: 1px solid #9dd7b8; color: #075f3a; padding: 10px; margin: 10px 0; display: none; }
                #aaventure-attendance-v2 .aav-row { display: grid; grid-template-columns: 1fr; gap: 12px; }
                #aaventure-attendance-v2 .aav-helper-box { background: #f7fafc; border: 1px solid #d0deea; border-radius: 6px; padding: 10px; margin-top: 8px; display: none; }
                #aaventure-attendance-v2 .aav-helper-actions { margin-top: 6px; }
                #aaventure-attendance-v2 .aav-actions { margin-top: 16px; display: flex; gap: 8px; }
                #aaventure-attendance-v2 .aav-readonly { background: #f3f3f3; }
            </style>
            <p>Check in to the meeting when you arrive, submit the form when the meeting has ended. Your check in and submit time will be printed on your certificate.</p>
            <div id="aav-global-top" class="aav-global" aria-live="polite"></div>
            <div id="aav-success-top" class="aav-success" aria-live="polite"></div>

            <label class="aav-label" for="aav-full-name">Your Full Name (will be used on your form)</label>
            <input class="aav-input" id="aav-full-name" maxlength="120" />
            <p id="aav-error-attendeeFullName" class="aav-field-error">The field is required.</p>

            <label class="aav-label" for="aav-email">Your Email (required)</label>
            <input class="aav-input" id="aav-email" type="email" maxlength="255" />
            <p id="aav-error-attendeeEmail" class="aav-field-error">The field is required.</p>

            <label class="aav-label" for="aav-extra-choice">Send Proof of Attendance to Additional Recipient? (required)</label>
            <select class="aav-select" id="aav-extra-choice">
                <option value="">-- CHOOSE ONE --</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
            </select>
            <p id="aav-error-extraRecipientChoice" class="aav-field-error">The field is required.</p>

            <div id="aav-extra-email-wrap" style="display:none;">
                <label class="aav-label" for="aav-extra-email">Additional Recipient Email</label>
                <input class="aav-input" id="aav-extra-email" type="email" maxlength="255" />
                <p id="aav-error-extraRecipientEmail" class="aav-field-error">The field is required.</p>
            </div>

            <label class="aav-label" for="aav-meeting-id">Meeting ID (cannot be edited - ID below is specific to your user, the meeting date, and the meeting time)</label>
            <input class="aav-input aav-readonly" id="aav-meeting-id" readonly />
            <p class="aav-hint" id="aav-checkin-hint"></p>

            <div class="aav-row">
                <div>
                    <label class="aav-label" for="aav-meeting-date">Meeting Date (required)</label>
                    <input class="aav-input" id="aav-meeting-date" type="date" />
                    <p id="aav-error-meetingDateInput" class="aav-field-error">The field is required.</p>
                </div>
                <div>
                    <label class="aav-label" for="aav-meeting-time">Meeting Time (required)</label>
                    <input class="aav-input" id="aav-meeting-time" value="7:00PM EDT" maxlength="40" />
                    <p id="aav-error-meetingTimeInput" class="aav-field-error">The field is required.</p>
                </div>
            </div>

            <label class="aav-label" for="aav-topic">Meeting Topic (required - please put the actual topic, NOT the meeting name)</label>
            <input class="aav-input" id="aav-topic" maxlength="200" />
            <div class="aav-actions">
                <button type="button" id="aav-topic-help">Get help writing this</button>
            </div>
            <p id="aav-error-meetingTopicInput" class="aav-field-error">The field is required.</p>

            <label class="aav-label" for="aav-chair">Meeting Chairperson (required)</label>
            <input class="aav-input" id="aav-chair" maxlength="120" />
            <p id="aav-error-meetingChairpersonInput" class="aav-field-error">The field is required.</p>

            <label class="aav-label" for="aav-participation">Describe How You Participated/Additional Info (required)</label>
            <p class="aav-hint">(example: "I shared", or "I just listened")</p>
            <textarea class="aav-textarea" id="aav-participation" maxlength="1000"></textarea>
            <div class="aav-actions">
                <button type="button" id="aav-participation-help">Get help writing this</button>
            </div>
            <p id="aav-error-participationInfoInput" class="aav-field-error">The field is required.</p>

            <div id="aav-helper-box" class="aav-helper-box" aria-live="polite">
                <strong>Assistant Suggestions</strong>
                <p id="aav-helper-disclaimer" class="aav-hint"></p>
                <div id="aav-helper-topic-wrap" style="display:none;">
                    <p><strong>Meeting topic suggestion:</strong></p>
                    <p id="aav-helper-topic"></p>
                    <div class="aav-helper-actions"><button type="button" id="aav-use-topic">Use suggestion</button></div>
                </div>
                <div id="aav-helper-participation-wrap" style="display:none;">
                    <p><strong>Participation suggestion:</strong></p>
                    <p id="aav-helper-participation"></p>
                    <div class="aav-helper-actions"><button type="button" id="aav-use-participation">Use suggestion</button></div>
                </div>
                <p id="aav-helper-chair-hint" class="aav-hint"></p>
                <div id="aav-helper-warnings"></div>
            </div>

            <div class="aav-actions">
                <button type="button" id="aav-submit">Submit Attendance Form</button>
                <button type="button" id="aav-load-meta">Reload Meeting ID</button>
            </div>
            <div id="aav-global-bottom" class="aav-global" aria-live="polite"></div>
            <div id="aav-success-bottom" class="aav-success" aria-live="polite"></div>
        </div>
        <script>
        (function () {
            const base = <?php echo wp_json_encode($rest_base); ?>;
            const nonce = <?php echo wp_json_encode($nonce); ?>;
            const globalErrorText = 'One or more fields have an error. Please check and try again.';
            const ids = {
                fullName: document.getElementById('aav-full-name'),
                email: document.getElementById('aav-email'),
                extraChoice: document.getElementById('aav-extra-choice'),
                extraWrap: document.getElementById('aav-extra-email-wrap'),
                extraEmail: document.getElementById('aav-extra-email'),
                meetingId: document.getElementById('aav-meeting-id'),
                checkinHint: document.getElementById('aav-checkin-hint'),
                meetingDate: document.getElementById('aav-meeting-date'),
                meetingTime: document.getElementById('aav-meeting-time'),
                topic: document.getElementById('aav-topic'),
                chair: document.getElementById('aav-chair'),
                participation: document.getElementById('aav-participation'),
                submit: document.getElementById('aav-submit'),
                loadMeta: document.getElementById('aav-load-meta'),
                topicHelp: document.getElementById('aav-topic-help'),
                participationHelp: document.getElementById('aav-participation-help'),
                globalTop: document.getElementById('aav-global-top'),
                globalBottom: document.getElementById('aav-global-bottom'),
                successTop: document.getElementById('aav-success-top'),
                successBottom: document.getElementById('aav-success-bottom'),
                helperBox: document.getElementById('aav-helper-box'),
                helperDisclaimer: document.getElementById('aav-helper-disclaimer'),
                helperTopicWrap: document.getElementById('aav-helper-topic-wrap'),
                helperTopic: document.getElementById('aav-helper-topic'),
                helperParticipationWrap: document.getElementById('aav-helper-participation-wrap'),
                helperParticipation: document.getElementById('aav-helper-participation'),
                helperChairHint: document.getElementById('aav-helper-chair-hint'),
                helperWarnings: document.getElementById('aav-helper-warnings'),
                useTopic: document.getElementById('aav-use-topic'),
                useParticipation: document.getElementById('aav-use-participation')
            };

            const fieldErrors = {
                attendeeFullName: document.getElementById('aav-error-attendeeFullName'),
                attendeeEmail: document.getElementById('aav-error-attendeeEmail'),
                extraRecipientChoice: document.getElementById('aav-error-extraRecipientChoice'),
                extraRecipientEmail: document.getElementById('aav-error-extraRecipientEmail'),
                meetingDateInput: document.getElementById('aav-error-meetingDateInput'),
                meetingTimeInput: document.getElementById('aav-error-meetingTimeInput'),
                meetingTopicInput: document.getElementById('aav-error-meetingTopicInput'),
                meetingChairpersonInput: document.getElementById('aav-error-meetingChairpersonInput'),
                participationInfoInput: document.getElementById('aav-error-participationInfoInput')
            };

            function clearFieldErrors() {
                Object.values(fieldErrors).forEach(function (el) {
                    if (el) el.style.display = 'none';
                });
            }

            function hideNotices() {
                [ids.globalTop, ids.globalBottom, ids.successTop, ids.successBottom].forEach(function (el) {
                    if (!el) return;
                    el.style.display = 'none';
                    el.textContent = '';
                });
            }

            function showGlobalError(msg) {
                [ids.globalTop, ids.globalBottom].forEach(function (el) {
                    if (!el) return;
                    el.textContent = msg || globalErrorText;
                    el.style.display = 'block';
                });
            }

            function showSuccess(msg) {
                [ids.successTop, ids.successBottom].forEach(function (el) {
                    if (!el) return;
                    el.textContent = msg;
                    el.style.display = 'block';
                });
            }

            function showValidationErrors(errors) {
                clearFieldErrors();
                Object.keys(errors || {}).forEach(function (key) {
                    const el = fieldErrors[key];
                    if (el) {
                        el.style.display = 'block';
                        el.textContent = errors[key] || 'The field is required.';
                    }
                });
                showGlobalError(globalErrorText);
            }

            function isoDateToday() {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                return y + '-' + m + '-' + d;
            }

            async function loadMetadata() {
                hideNotices();
                try {
                    const res = await fetch(base + '/verification-form-metadata', {
                        method: 'GET',
                        headers: { 'X-WP-Nonce': nonce }
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load meeting ID');
                    ids.meetingId.value = data.meetingIdDisplay || '';
                    ids.checkinHint.textContent = data.checkInAt ? ('Checked in at: ' + data.checkInAt) : '';
                    if (!ids.meetingDate.value) ids.meetingDate.value = isoDateToday();
                } catch (e) {
                    showGlobalError(e.message || 'Failed to load metadata');
                }
            }

            function payload() {
                return {
                    fullName: ids.fullName.value.trim(),
                    email: ids.email.value.trim(),
                    sendAdditionalRecipient: ids.extraChoice.value,
                    additionalRecipientEmail: ids.extraEmail.value.trim(),
                    meetingIdDisplay: ids.meetingId.value.trim(),
                    meetingDate: ids.meetingDate.value.trim(),
                    meetingTime: ids.meetingTime.value.trim(),
                    meetingTopic: ids.topic.value.trim(),
                    meetingChairperson: ids.chair.value.trim(),
                    participationInfo: ids.participation.value.trim()
                };
            }

            function localValidate(body) {
                const errors = {};
                if (!body.fullName) errors.attendeeFullName = 'The field is required.';
                if (!body.email) errors.attendeeEmail = 'The field is required.';
                if (!body.sendAdditionalRecipient) errors.extraRecipientChoice = 'The field is required.';
                if (body.sendAdditionalRecipient === 'yes' && !body.additionalRecipientEmail) errors.extraRecipientEmail = 'The field is required.';
                if (!body.meetingDate) errors.meetingDateInput = 'The field is required.';
                if (!body.meetingTime) errors.meetingTimeInput = 'The field is required.';
                if (!body.meetingTopic) errors.meetingTopicInput = 'The field is required.';
                if (!body.meetingChairperson) errors.meetingChairpersonInput = 'The field is required.';
                if (!body.participationInfo) errors.participationInfoInput = 'The field is required.';
                return errors;
            }

            async function submitForm() {
                hideNotices();
                clearFieldErrors();
                const body = payload();
                const localErrors = localValidate(body);
                if (Object.keys(localErrors).length > 0) {
                    showValidationErrors(localErrors);
                    return;
                }

                ids.submit.disabled = true;
                ids.submit.textContent = 'Submitting...';
                try {
                    const res = await fetch(base + '/submit-verification-form', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': nonce
                        },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        if (data.validationErrors) {
                            showValidationErrors(data.validationErrors);
                        } else {
                            showGlobalError(data.error || globalErrorText);
                        }
                        return;
                    }
                    const certText = data.linkedCertificateId ? (' Certificate ID: ' + data.linkedCertificateId + '.') : '';
                    showSuccess(data.message + ' Submission #' + data.submissionId + ' (revision ' + data.revision + ').' + certText);
                } catch (e) {
                    showGlobalError(e.message || 'Unable to submit form');
                } finally {
                    ids.submit.disabled = false;
                    ids.submit.textContent = 'Submit Attendance Form';
                }
            }

            async function requestHelper(kind) {
                hideNotices();
                try {
                    const res = await fetch(base + '/helper-suggest', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': nonce
                        },
                        body: JSON.stringify({
                            meetingTopic: ids.topic.value.trim(),
                            meetingChairperson: ids.chair.value.trim(),
                            participationInfo: ids.participation.value.trim()
                        })
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.error || 'Unable to fetch suggestions');
                    ids.helperBox.style.display = 'block';
                    ids.helperDisclaimer.textContent = data.disclaimer || 'Review before submit.';
                    ids.helperChairHint.textContent = data.chairpersonPromptHint || '';

                    if (data.meetingTopicSuggestion) {
                        ids.helperTopicWrap.style.display = 'block';
                        ids.helperTopic.textContent = data.meetingTopicSuggestion;
                        ids.useTopic.onclick = function () { ids.topic.value = data.meetingTopicSuggestion; };
                    }
                    if (data.participationInfoSuggestion) {
                        ids.helperParticipationWrap.style.display = 'block';
                        ids.helperParticipation.textContent = data.participationInfoSuggestion;
                        ids.useParticipation.onclick = function () { ids.participation.value = data.participationInfoSuggestion; };
                    }

                    ids.helperWarnings.innerHTML = '';
                    if (Array.isArray(data.qualityWarnings) && data.qualityWarnings.length > 0) {
                        const ul = document.createElement('ul');
                        data.qualityWarnings.forEach(function (warning) {
                            const li = document.createElement('li');
                            li.textContent = warning;
                            ul.appendChild(li);
                        });
                        ids.helperWarnings.appendChild(ul);
                    }

                    if (kind === 'topic' && data.meetingTopicSuggestion) {
                        ids.topic.focus();
                    } else if (kind === 'participation' && data.participationInfoSuggestion) {
                        ids.participation.focus();
                    }
                } catch (e) {
                    showGlobalError(e.message || 'Unable to fetch helper suggestions');
                }
            }

            ids.extraChoice.addEventListener('change', function () {
                ids.extraWrap.style.display = ids.extraChoice.value === 'yes' ? 'block' : 'none';
                if (ids.extraChoice.value !== 'yes') ids.extraEmail.value = '';
            });
            ids.loadMeta.addEventListener('click', loadMetadata);
            ids.submit.addEventListener('click', submitForm);
            ids.topicHelp.addEventListener('click', function () { requestHelper('topic'); });
            ids.participationHelp.addEventListener('click', function () { requestHelper('participation'); });
            loadMetadata();
        })();
        </script>
        <?php
        return ob_get_clean();
    }
}

AAVenture_Attendance_V2::init();
