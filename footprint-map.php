<?php
/**
 * Plugin Name: 足迹地图
 * Plugin URI: https://github.com/Frank-Loong/Footprint-Map
 * Description: 基于高德地图API的足迹展示插件，可以在地图上标记您去过的城市
 * Version: 1.2.1
 * Author: Frank Loong
 * Author URI: https://frankloong.com
 * Author Email: frankloong@qq.com
 * License: GPL v3
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: footprint-map
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 */

// 防止直接访问
if (!defined('ABSPATH')) {
    exit;
}

// 版本要求检查
function footprint_map_check_requirements() {
    $errors = array();
    
    // 检查WordPress版本
    if (version_compare(get_bloginfo('version'), '5.0', '<')) {
        $errors[] = '足迹地图插件需要WordPress 5.0或更高版本。当前版本：' . get_bloginfo('version');
    }
    
    // 检查PHP版本
    if (version_compare(PHP_VERSION, '7.4', '<')) {
        $errors[] = '足迹地图插件需要PHP 7.4或更高版本。当前版本：' . PHP_VERSION;
    }
    
    // 检查必要的PHP扩展
    if (!function_exists('json_decode')) {
        $errors[] = '足迹地图插件需要PHP JSON扩展。';
    }
    
    if (!function_exists('mb_strtolower')) {
        $errors[] = '足迹地图插件需要PHP mbstring扩展。';
    }
    
    if (!function_exists('curl_init') && !function_exists('wp_remote_get')) {
        $errors[] = '足迹地图插件需要PHP cURL扩展或WordPress HTTP API支持。';
    }
    
    return $errors;
}

// 在插件激活时检查版本要求
function footprint_map_activation_check() {
    $errors = footprint_map_check_requirements();
    
    if (!empty($errors)) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            '<h1>插件激活失败</h1>' .
            '<p>足迹地图插件无法激活，原因如下：</p>' .
            '<ul><li>' . implode('</li><li>', $errors) . '</li></ul>' .
            '<p><a href="' . admin_url('plugins.php') . '">返回插件列表</a></p>'
        );
    }
}

// 在管理页面显示版本要求警告
function footprint_map_admin_notices() {
    if (isset($_GET['page']) && $_GET['page'] === 'footprint-map-settings') {
        $errors = footprint_map_check_requirements();
        
        if (!empty($errors)) {
            echo '<div class="notice notice-error">';
            echo '<p><strong>足迹地图插件系统要求检查失败：</strong></p>';
            echo '<ul><li>' . implode('</li><li>', $errors) . '</li></ul>';
            echo '</div>';
        }
    }
}

add_action('admin_notices', 'footprint_map_admin_notices');

// 定义插件常量
define('FOOTPRINT_MAP_VERSION', '1.2.1');
define('FOOTPRINT_MAP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FOOTPRINT_MAP_PLUGIN_PATH', plugin_dir_path(__FILE__));

// 主插件类
class FootprintMap {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_shortcode('footprint_map', array($this, 'shortcode'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // AJAX处理
        add_action('wp_ajax_footprint_map_save_city', array($this, 'ajax_save_city'));
        add_action('wp_ajax_footprint_map_delete_city', array($this, 'ajax_delete_city'));
        add_action('wp_ajax_footprint_map_backup_webdav', array($this, 'ajax_backup_webdav'));
        add_action('wp_ajax_footprint_map_restore_webdav', array($this, 'ajax_restore_webdav'));
        add_action('wp_ajax_footprint_map_get_cities', array($this, 'ajax_get_cities'));
        add_action('wp_ajax_footprint_map_search_city', array($this, 'ajax_search_city'));
        add_action('wp_ajax_footprint_map_export_json', array($this, 'ajax_export_json'));
        add_action('wp_ajax_footprint_map_import_json', array($this, 'ajax_import_json'));
        add_action('wp_ajax_footprint_map_update_city', array($this, 'ajax_update_city'));
        
        // 异步备份处理
        add_action('footprint_map_async_backup', array($this, 'async_backup_to_webdav'));
    }
    
    public function init() {
        load_plugin_textdomain('footprint-map', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function enqueue_scripts() {
        wp_enqueue_style('footprint-map-css', FOOTPRINT_MAP_PLUGIN_URL . 'assets/css/footprint-map.css', array(), '1.0');
        // 不再通过wp_enqueue_script加载高德地图loader，改由前端动态加载
        wp_enqueue_script('footprint-map-js', FOOTPRINT_MAP_PLUGIN_URL . 'assets/js/footprint-map.js', array('jquery'), '1.2', true);
            
        wp_localize_script('footprint-map-js', 'footprintMapData', array(
                'amapKey' => get_option('footprint_map_amap_key', ''),
                'amapSecurityCode' => get_option('footprint_map_amap_security_code', ''),
                'cities' => $this->get_cities_data()
            ));
    }
    
    public function admin_enqueue_scripts($hook) {
        if ('settings_page_footprint-map-settings' !== $hook) {
            return;
        }
        
        wp_enqueue_script('footprint-map-admin', FOOTPRINT_MAP_PLUGIN_URL . 'assets/js/footprint-map-admin.js', array('jquery'), FOOTPRINT_MAP_VERSION, true);
        wp_enqueue_style('footprint-map-admin', FOOTPRINT_MAP_PLUGIN_URL . 'assets/css/footprint-map-admin.css', array(), FOOTPRINT_MAP_VERSION);
        
        wp_localize_script('footprint-map-admin', 'footprintMapAdmin', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('footprint_map_admin_nonce'),
            'amapKey' => get_option('footprint_map_amap_key', ''),
            'pickerUrl' => 'https://lbs.amap.com/tools/picker',
            'webdavUrl' => get_option('footprint_map_webdav_url', ''),
            'webdavUsername' => get_option('footprint_map_webdav_username', ''),
            'webdavPassword' => get_option('footprint_map_webdav_password', ''),
            'webdavDirectory' => get_option('footprint_map_webdav_directory', 'footprint-map-backups'),
            'strings' => array(
                'confirmDelete' => __('确定要删除这个城市吗？', 'footprint-map'),
                'saveSuccess' => __('城市保存成功！', 'footprint-map'),
                'deleteSuccess' => __('城市删除成功！', 'footprint-map'),
                'backupSuccess' => __('备份成功！', 'footprint-map'),
                'restoreSuccess' => __('恢复成功！', 'footprint-map'),
                'error' => __('操作失败，请重试', 'footprint-map')
            )
        ));
    }
    
    public function add_admin_menu() {
        add_options_page(
            '足迹地图设置',
            '足迹地图',
            'manage_options',
            'footprint-map-settings',
            array($this, 'admin_page')
        );
    }
    
    public function admin_init() {
        register_setting('footprint_map_options', 'footprint_map_amap_key');
        register_setting('footprint_map_options', 'footprint_map_amap_security_code');
        register_setting('footprint_map_options', 'footprint_map_webdav_url');
        register_setting('footprint_map_options', 'footprint_map_webdav_username');
        register_setting('footprint_map_options', 'footprint_map_webdav_password');
        register_setting('footprint_map_options', 'footprint_map_webdav_directory');
        
        add_settings_section(
            'footprint_map_general',
            '基本设置',
            array($this, 'settings_section_callback'),
            'footprint-map-settings'
        );
        
        add_settings_field(
            'footprint_map_amap_key',
            '高德地图API Key',
            array($this, 'amap_key_callback'),
            'footprint-map-settings',
            'footprint_map_general'
        );
        
        add_settings_field(
            'footprint_map_amap_security_code',
            '高德地图安全密钥',
            array($this, 'amap_security_code_callback'),
            'footprint-map-settings',
            'footprint_map_general'
        );
        
        add_settings_section(
            'footprint_map_webdav',
            'WebDAV备份设置',
            array($this, 'webdav_section_callback'),
            'footprint-map-settings'
        );
        
        add_settings_field(
            'footprint_map_webdav_url',
            'WebDAV服务器地址',
            array($this, 'webdav_url_callback'),
            'footprint-map-settings',
            'footprint_map_webdav'
        );
        
        add_settings_field(
            'footprint_map_webdav_username',
            'WebDAV用户名',
            array($this, 'webdav_username_callback'),
            'footprint-map-settings',
            'footprint_map_webdav'
        );
        
        add_settings_field(
            'footprint_map_webdav_password',
            'WebDAV密码',
            array($this, 'webdav_password_callback'),
            'footprint-map-settings',
            'footprint_map_webdav'
        );
        
        add_settings_field(
            'footprint_map_webdav_directory',
            '备份文件存储目录',
            array($this, 'webdav_directory_callback'),
            'footprint-map-settings',
            'footprint_map_webdav'
        );
    }
    
    public function settings_section_callback() {
        echo '<p>配置高德地图API</p>';
    }
    
    public function webdav_section_callback() {
        echo '<p>配置WebDAV服务器用于自动备份城市数据</p>';
    }
    
    public function amap_key_callback() {
        $value = get_option('footprint_map_amap_key', '');
        echo '<input type="text" id="footprint_map_amap_key" name="footprint_map_amap_key" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">请在高德开放平台申请Web端(JS API)的Key</p>';
    }
    
    public function amap_security_code_callback() {
        $value = get_option('footprint_map_amap_security_code', '');
        echo '<input type="text" id="footprint_map_amap_security_code" name="footprint_map_amap_security_code" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">请在高德开放平台申请安全密钥</p>';
    }
    
    public function webdav_url_callback() {
        $value = get_option('footprint_map_webdav_url', '');
        echo '<input type="url" id="footprint_map_webdav_url" name="footprint_map_webdav_url" value="' . esc_attr($value) . '" class="regular-text" placeholder="https://your-webdav-server.com/path" />';
        echo '<p class="description">WebDAV服务器地址，例如：https://dav.jianguoyun.com/dav/</p>';
    }
    
    public function webdav_username_callback() {
        $value = get_option('footprint_map_webdav_username', '');
        echo '<input type="text" id="footprint_map_webdav_username" name="footprint_map_webdav_username" value="' . esc_attr($value) . '" class="regular-text" />';
    }
    
    public function webdav_password_callback() {
        $value = get_option('footprint_map_webdav_password', '');
        echo '<input type="password" id="footprint_map_webdav_password" name="footprint_map_webdav_password" value="' . esc_attr($value) . '" class="regular-text" />';
    }
    
    public function webdav_directory_callback() {
        $value = get_option('footprint_map_webdav_directory', 'footprint-map-backups');
        echo '<input type="text" id="footprint_map_webdav_directory" name="footprint_map_webdav_directory" value="' . esc_attr($value) . '" class="regular-text" placeholder="footprint-map-backups" />';
        echo '<p class="description">备份文件存储目录，留空则存储在根目录。建议使用专门的备份目录。</p>';
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>足迹地图管理</h1>
            
            <div class="footprint-map-admin-layout">
                <!-- 侧边菜单 -->
                <div class="footprint-map-sidebar">
                    <nav class="footprint-map-nav">
                        <ul>
                            <li><a href="#basic-settings" class="nav-item active" data-tab="basic-settings">
                                <span class="nav-icon">⚙️</span>
                                <span class="nav-text">基础设置</span>
                            </a></li>
                            <li><a href="#backup-settings" class="nav-item" data-tab="backup-settings">
                                <span class="nav-icon">💾</span>
                                <span class="nav-text">备份设置</span>
                            </a></li>
                            <li><a href="#city-management" class="nav-item" data-tab="city-management">
                                <span class="nav-icon">📍</span>
                                <span class="nav-text">城市管理</span>
                            </a></li>
                            <li><a href="#city-list" class="nav-item" data-tab="city-list">
                                <span class="nav-icon">📋</span>
                                <span class="nav-text">城市列表</span>
                            </a></li>
                            <li><a href="#import-export" class="nav-item" data-tab="import-export">
                                <span class="nav-icon">📤</span>
                                <span class="nav-text">导入导出</span>
                            </a></li>
                            <li><a href="#help" class="nav-item" data-tab="help">
                                <span class="nav-icon">❓</span>
                                <span class="nav-text">使用说明</span>
                            </a></li>
                            <li><a href="#about" class="nav-item" data-tab="about">
                                <span class="nav-icon">👨‍💻</span>
                                <span class="nav-text">关于作者</span>
                            </a></li>
                        </ul>
                    </nav>
                </div>
                
                <!-- 主内容区域 -->
                <div class="footprint-map-main">
                    <!-- 基础设置 -->
                    <div id="basic-settings" class="content-panel active">
                        <div class="panel-header">
                            <h2>基础设置</h2>
                            <p>配置高德地图API和基本参数</p>
                        </div>
                        <div class="panel-content">
                            <form method="post" action="options.php">
                                <?php
                                settings_fields('footprint_map_options');
                                do_settings_sections('footprint-map-settings');
                                submit_button('保存设置');
                                ?>
                            </form>
                        </div>
                    </div>
                    
                    <!-- 备份设置 -->
                    <div id="backup-settings" class="content-panel">
                        <div class="panel-header">
                            <h2>备份设置</h2>
                            <p>配置WebDAV服务器用于自动备份城市数据</p>
                        </div>
                        <div class="panel-content">
                            <div class="footprint-map-backup">
                                <div class="backup-actions">
                                    <button type="button" id="backup-now" class="button">立即备份</button>
                                    <button type="button" id="restore-data" class="button">恢复数据</button>
                                </div>
                                <div id="backup-status">上次备份时间：未备份</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 城市管理 -->
                    <div id="city-management" class="content-panel">
                        <div class="panel-header">
                            <h2>城市管理</h2>
                            <p>添加和编辑您的城市足迹</p>
                        </div>
                        <div class="panel-content">
                            <div class="footprint-map-city-manager">
                                <div class="city-form">
                                    <div class="form-group">
                                        <label for="city-name">城市名称</label>
                                        <input type="text" id="city-name" placeholder="例如：北京">
                                        <small>输入城市名称可自动搜索并填充城市编码和坐标</small>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-adcode">城市编码</label>
                                        <input type="text" id="city-adcode" placeholder="例如：110000">
                                        <small>可参考城市编码表或使用坐标拾取器</small>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-center">坐标</label>
                                        <input type="text" id="city-center" placeholder="例如：116.407526,39.904030">
                                        <button type="button" id="open-picker" class="button">坐标拾取器</button>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-opacity">透明度</label>
                                        <input type="range" id="city-opacity" min="1" max="10" value="8">
                                        <span id="opacity-value">8</span>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-desc">描述内容</label>
                                        <textarea id="city-desc" rows="4" placeholder="支持HTML和Markdown格式，例如：&#10;HTML: &lt;b&gt;北京&lt;/b&gt; - &lt;i&gt;首都&lt;/i&gt;&#10;Markdown: **北京** - *首都*&#10;在这里记录您对这座城市的美好回忆..."></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-image">图片URL</label>
                                        <input type="text" id="city-image" placeholder="https://example.com/image1.jpg,https://example.com/image2.jpg">
                                        <small>支持多张图片，用逗号分隔多个URL</small>
                                    </div>
                                    <div class="form-group">
                                        <label for="city-tags">标签</label>
                                        <input type="text" id="city-tags" placeholder="工作,旅游,生活 (用逗号分隔)">
                                    </div>
                                    <div class="form-group">
                                        <label for="city-date">访问日期</label>
                                        <div class="date-range-container">
                                            <div class="date-input-group">
                                                <label for="city-date-start">开始日期</label>
                                                <input type="date" id="city-date-start">
                                            </div>
                                            <div class="date-input-group">
                                                <label for="city-date-end">结束日期</label>
                                                <input type="date" id="city-date-end">
                                            </div>
                                            <div class="date-options">
                                                <label>
                                                    <input type="checkbox" id="same-day-checkbox" checked>
                                                    同一天
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="form-actions">
                                        <button type="button" id="save-city" class="button button-primary">保存城市</button>
                                        <button type="button" id="preview-desc" class="button">预览描述</button>
                                        <button type="button" id="clear-form" class="button">清空表单</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 城市列表 -->
                    <div id="city-list" class="content-panel">
                        <div class="panel-header">
                            <h2>城市列表</h2>
                            <p>管理您已添加的所有城市</p>
                        </div>
                        <div class="panel-content">
                            <div class="city-list">
                                <div class="city-list-header">
                                    <h3 class="city-list-title">城市列表</h3>
                                    <div class="city-list-controls">
                                        <div class="city-search-box">
                                            <input type="text" placeholder="搜索城市..." id="city-list-search">
                                            <span class="search-icon">🔍</span>
                                        </div>
                                        <div class="city-filter">
                                            <button type="button" class="filter-btn active" data-filter="all">全部</button>
                                            <button type="button" class="filter-btn" data-filter="recent">最近添加</button>
                                            <button type="button" class="filter-btn" data-filter="tagged">有标签</button>
                                        </div>
                                    </div>
                                </div>
                                <div id="cities-container" class="cities-container">
                                    <!-- 城市列表将通过JavaScript动态加载 -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 导入导出 -->
                    <div id="import-export" class="content-panel">
                        <div class="panel-header">
                            <h2>导入导出</h2>
                            <p>备份和恢复您的城市数据</p>
                        </div>
                        <div class="panel-content">
                            <div class="footprint-map-backup">
                                <div class="backup-actions">
                                    <button type="button" id="export-json" class="button">导出JSON</button>
                                    <button type="button" id="import-json" class="button">导入JSON</button>
                                </div>
                                
                                <div id="import-options" class="import-options" style="display: none;">
                                    <div class="import-tabs">
                                        <button type="button" class="import-tab active" data-tab="file">文件上传</button>
                                        <button type="button" class="import-tab" data-tab="json">JSON输入</button>
                                    </div>
                                    <div class="import-content">
                                        <div id="import-file" class="import-panel active">
                                            <div class="form-group">
                                                <label for="import-json-file">选择JSON文件</label>
                                                <input type="file" id="import-json-file" accept=".json">
                                                <small>支持最大2MB的JSON文件</small>
                                            </div>
                                            <div class="form-actions">
                                                <button type="button" id="import-file-btn" class="button button-primary">导入文件</button>
                                                <button type="button" id="cancel-import" class="button">取消</button>
                                            </div>
                                        </div>
                                        <div id="import-json-input" class="import-panel">
                                            <div class="form-group">
                                                <label for="json-input">JSON数据</label>
                                                <textarea id="json-input" rows="10" placeholder="请粘贴JSON数据..."></textarea>
                                                <small>请确保JSON格式正确</small>
                                            </div>
                                            <div class="form-actions">
                                                <button type="button" id="import-json-btn" class="button button-primary">导入数据</button>
                                                <button type="button" id="cancel-import-json" class="button">取消</button>
                                                <button type="button" id="show-json-example" class="button">查看示例</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 使用说明 -->
                    <div id="help" class="content-panel">
                        <div class="panel-header">
                            <h2>使用说明</h2>
                            <p>了解如何使用足迹地图插件</p>
                        </div>
                        <div class="panel-content">
                            <div class="footprint-map-help">
                                <div class="help-content">
                                    <div class="help-section">
                                        <h3>快速开始</h3>
                                        <ul>
                                            <li>在"基础设置"中配置高德地图API Key</li>
                                            <li>在"城市管理"中添加您的第一个城市</li>
                                            <li>使用坐标拾取器获取精确的城市坐标</li>
                                            <li>添加描述、图片和标签丰富城市信息</li>
                                        </ul>
                                    </div>
                                    <div class="help-section">
                                        <h3>功能特性</h3>
                                        <ul>
                                            <li>支持中国大陆、港澳台、海外地区</li>
                                            <li>智能城市搜索，自动填充编码和坐标</li>
                                            <li>多张图片支持，网格布局显示</li>
                                            <li>支持HTML和Markdown格式描述</li>
                                            <li>WebDAV自动备份和恢复</li>
                                        </ul>
                                    </div>
                                    <div class="help-section">
                                        <h3>数据管理</h3>
                                        <ul>
                                            <li>使用"城市列表"管理所有城市</li>
                                            <li>支持搜索、筛选和分页浏览</li>
                                            <li>JSON格式导入导出备份数据</li>
                                            <li>WebDAV云端备份确保数据安全</li>
                                        </ul>
                                    </div>
                                    <div class="help-section">
                                        <h3>显示效果</h3>
                                        <ul>
                                            <li>地图上高亮显示已访问的城市</li>
                                            <li>点击城市标记查看详细信息</li>
                                            <li>支持中国地图和世界地图切换</li>
                                            <li>响应式设计，适配各种设备</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 关于作者 -->
                    <div id="about" class="content-panel">
                        <div class="panel-header">
                            <h2>关于作者</h2>
                            <p>了解插件开发者和相关信息</p>
                        </div>
                        <div class="panel-content">
                            <div class="footprint-map-about">
                                <div class="author-info">
                                    <div class="author-avatar">
                                        <img src="https://oss.frankloong.com/image/0bb1c8701f21d57711ce043e9de44056.jpg" alt="Frank Loong" onerror="this.style.display='none'">
                                    </div>
                                    <div class="author-details">
                                        <h3>Frank Loong</h3>
                                        <p class="author-title">科技爱好者 & AI玩家</p>
                                        <p class="author-description">
                                            对互联网、计算机等科技行业充满热情，擅长AI工具的使用与调教。
                                            此足迹地图插件的开发，是在强大的AI编程助手Cursor的协助下完成的，现在将这个有趣的项目分享给大家。
                                        </p>
                                        <div class="author-links">
                                            <a href="https://frankloong.com" target="_blank" class="author-link">
                                                <span class="link-icon">🌐</span>
                                                个人网站
                                            </a>
                                            <a href="mailto:frankloong@qq.com" class="author-link">
                                                <span class="link-icon">📧</span>
                                                联系邮箱
                                            </a>
                                            <a href="https://github.com/Frank-Loong" target="_blank" class="author-link">
                                                <span class="link-icon">💻</span>
                                                GitHub
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="plugin-info">
                                    <h4>插件信息</h4>
                                    <div class="info-grid">
                                        <div class="info-item">
                                            <span class="info-label">版本：</span>
                                            <span class="info-value">1.2.1</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">许可证：</span>
                                            <span class="info-value">GPL v3</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">最后更新：</span>
                                            <span class="info-value">2025年6月</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">兼容性：</span>
                                            <span class="info-value">WordPress 5.0+</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="support-info">
                                    <h4>支持与反馈</h4>
                                    <p>如果您在使用过程中遇到问题或有改进建议，欢迎通过以下方式联系我：</p>
                                    <ul>
                                        <li>📧 邮箱：frankloong@qq.com</li>
                                        <li>🌐 网站：<a href="https://frankloong.com" target="_blank">frankloong.com</a></li>
                                        <li>💻 GitHub：<a href="https://github.com/Frank-Loong" target="_blank">github.com/Frank-Loong</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
    
    public function shortcode($atts) {
        $atts = shortcode_atts(array(
            'width' => '100%',
            'height' => '500px'
        ), $atts);
        
        $output = '<div id="footprint-map-container" style="width: ' . esc_attr($atts['width']) . '; height: ' . esc_attr($atts['height']) . ';"></div>';
        
        return $output;
    }
    
    private function get_cities_data() {
        $cities = get_option('footprint_map_cities', array());
        if (is_string($cities)) {
            $cities = json_decode($cities, true);
        }
        return is_array($cities) ? $cities : array();
    }
    
    // AJAX处理函数
    public function ajax_save_city() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        
        // 验证必需字段
        $required_fields = array('adcode', 'name', 'center');
        foreach ($required_fields as $field) {
            if (empty($_POST[$field])) {
                wp_send_json_error(array('message' => "缺少必需字段: {$field}"));
                return;
            }
        }
        
        // 验证坐标格式
        $center = sanitize_text_field($_POST['center']);
        if (!preg_match('/^-?\d+\.\d+,-?\d+\.\d+$/', $center)) {
            wp_send_json_error(array('message' => '坐标格式不正确，请使用"经度,纬度"格式'));
            return;
        }
        
        // 验证透明度范围
        $opacity = intval($_POST['opacity']);
        if ($opacity < 1 || $opacity > 10) {
            wp_send_json_error(array('message' => '透明度必须在1-10之间'));
            return;
        }
        
        $city_data = array(
            'adcode' => sanitize_text_field($_POST['adcode']),
            'name' => sanitize_text_field($_POST['name']),
            'center' => $center,
            'opacity' => $opacity,
            'desc' => wp_kses_post($_POST['desc']),
            'image' => implode(',', array_map('esc_url_raw', explode(',', sanitize_text_field($_POST['image'])))),
            'tags' => sanitize_text_field($_POST['tags']),
            'created_at' => current_time('mysql')
        );
        
        // 处理时间段数据
        if (isset($_POST['date_start']) && isset($_POST['date_end'])) {
            $date_start = sanitize_text_field($_POST['date_start']);
            $date_end = sanitize_text_field($_POST['date_end']);
            
            // 验证日期格式
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_end)) {
                wp_send_json_error(array('message' => '日期格式不正确'));
                return;
            }
            
            // 验证日期逻辑
            if ($date_start > $date_end) {
                wp_send_json_error(array('message' => '开始日期不能晚于结束日期'));
                return;
            }
            
            $city_data['date_start'] = $date_start;
            $city_data['date_end'] = $date_end;
            $city_data['is_date_range'] = isset($_POST['is_date_range']) ? (bool)$_POST['is_date_range'] : false;
        } elseif (isset($_POST['date'])) {
            // 兼容旧数据格式
            $date = sanitize_text_field($_POST['date']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                wp_send_json_error(array('message' => '日期格式不正确'));
                return;
            }
            $city_data['date'] = $date;
        }
        
        $cities = $this->get_cities_data();
        $cities[] = $city_data;
        
        $update_result = update_option('footprint_map_cities', $cities);
        if ($update_result === false) {
            wp_send_json_error(array('message' => '保存失败，请重试'));
            return;
        }
        
        // 自动备份到WebDAV（异步处理，不阻塞用户操作）
        wp_schedule_single_event(time() + 5, 'footprint_map_async_backup', array($cities));
        
        wp_send_json_success(array('message' => '城市保存成功'));
    }
    
    public function ajax_delete_city() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        
        $index = intval($_POST['index']);
        $cities = $this->get_cities_data();
        
        if (isset($cities[$index])) {
            unset($cities[$index]);
            $cities = array_values($cities); // 重新索引
            update_option('footprint_map_cities', $cities);
            
            // 自动备份到WebDAV
            $this->backup_to_webdav($cities);
            
            wp_send_json_success(array('message' => '城市删除成功'));
        } else {
            wp_send_json_error(array('message' => '城市不存在'));
        }
    }
    
    public function ajax_update_city() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        
        $edit_index = intval($_POST['edit_index']);
        $cities = $this->get_cities_data();
        
        if (!isset($cities[$edit_index])) {
            wp_send_json_error(array('message' => '要更新的城市不存在'));
            return;
        }
        
        $city_data = array(
            'adcode' => sanitize_text_field($_POST['adcode']),
            'name' => sanitize_text_field($_POST['name']),
            'center' => sanitize_text_field($_POST['center']),
            'opacity' => intval($_POST['opacity']),
            'desc' => wp_kses_post($_POST['desc']),
            'image' => implode(',', array_map('esc_url_raw', explode(',', sanitize_text_field($_POST['image'])))),
            'tags' => sanitize_text_field($_POST['tags']),
            'created_at' => $cities[$edit_index]['created_at'] // 保持原始创建时间
        );
        
        // 处理时间段数据
        if (isset($_POST['date_start']) && isset($_POST['date_end'])) {
            $city_data['date_start'] = sanitize_text_field($_POST['date_start']);
            $city_data['date_end'] = sanitize_text_field($_POST['date_end']);
            $city_data['is_date_range'] = isset($_POST['is_date_range']) ? (bool)$_POST['is_date_range'] : false;
        } elseif (isset($_POST['date'])) {
            // 兼容旧数据格式
            $city_data['date'] = sanitize_text_field($_POST['date']);
        }
        
        $cities[$edit_index] = $city_data;
        update_option('footprint_map_cities', $cities);
        
        // 自动备份到WebDAV
        $this->backup_to_webdav($cities);
        
        wp_send_json_success(array('message' => '城市更新成功'));
    }
    
    public function ajax_backup_webdav() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => '权限不足'));
            return;
        }
        
        $webdav_url = get_option('footprint_map_webdav_url');
        $username = get_option('footprint_map_webdav_username');
        $password = get_option('footprint_map_webdav_password');
        
        // 检查WebDAV配置
        if (empty($webdav_url)) {
            wp_send_json_error(array('message' => '备份失败: 未配置WebDAV URL，请在设置页面配置WebDAV信息'));
            return;
        }
        
        if (empty($username)) {
            wp_send_json_error(array('message' => '备份失败: 未配置WebDAV用户名，请在设置页面配置WebDAV信息'));
            return;
        }
        
        if (empty($password)) {
            wp_send_json_error(array('message' => '备份失败: 未配置WebDAV密码，请在设置页面配置WebDAV信息'));
            return;
        }
        
        $cities = $this->get_cities_data();
        $result = $this->backup_to_webdav($cities);
        
        if ($result) {
            wp_send_json_success(array('message' => '备份成功！文件已上传到WebDAV服务器'));
        } else {
            wp_send_json_error(array('message' => '备份失败: 请检查WebDAV配置和网络连接，或查看服务器错误日志'));
        }
    }
    
    public function ajax_restore_webdav() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => '权限不足'));
            return;
        }
        
        $webdav_url = get_option('footprint_map_webdav_url');
        $username = get_option('footprint_map_webdav_username');
        $password = get_option('footprint_map_webdav_password');
        $directory = get_option('footprint_map_webdav_directory', 'footprint-map-backups');
        
        if (empty($webdav_url) || empty($username) || empty($password)) {
            wp_send_json_error(array('message' => 'WebDAV配置不完整'));
            return;
        }
        
        $filename = !empty($directory) ? trim($directory, '/') . '/footprint-map-backup.json' : 'footprint-map-backup.json';
        $request_url = rtrim($webdav_url, '/') . '/' . $filename;
        
        $response = wp_remote_get($request_url, array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password)
            ),
            'timeout' => 20 // 设置20秒超时
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => '恢复失败: ' . $response->get_error_message()));
            return;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            wp_send_json_error(array('message' => "恢复失败: 无法访问备份文件 (HTTP状态码: {$status_code})。请检查URL、目录和文件名是否正确。"));
            return;
        }
        
        $data = wp_remote_retrieve_body($response);
        if (empty($data)) {
            wp_send_json_error(array('message' => '恢复失败: 备份文件内容为空。'));
            return;
        }

        $cities = json_decode($data, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error(array('message' => '恢复失败: 备份文件JSON格式错误。'));
            return;
        }
        
        if (is_array($cities)) {
            update_option('footprint_map_cities', $cities);
            wp_send_json_success(array('message' => '从WebDAV恢复成功！'));
        } else {
            wp_send_json_error(array('message' => '恢复失败: 备份文件数据格式不正确。'));
        }
    }
    
    public function ajax_get_cities() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        
        $cities = $this->get_cities_data();
        wp_send_json_success($cities);
    }
    
    public function ajax_search_city() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        
        $search_term = sanitize_text_field($_POST['search_term']);
        
        if (empty($search_term) || strlen($search_term) < 1) {
            wp_send_json_success(array());
        }
        
        $results = $this->search_cities_in_json($search_term);
        wp_send_json_success($results);
    }
    
    private function search_cities_in_json($search_term) {
        $results = array();
        $json_files = array(
            'China-Mainland.json',
            'China-HongKong.json', 
            'China-Macau.json',
            'China-Taiwan.json',
            'Global-Overseas.json'
        );
        
        // 验证搜索词
        $search_term = trim($search_term);
        if (empty($search_term) || strlen($search_term) < 1) {
            return $results;
        }
        
        foreach ($json_files as $file) {
            $file_path = FOOTPRINT_MAP_PLUGIN_PATH . 'assets/data/' . $file;
            if (!file_exists($file_path)) {
                continue;
            }
            
            $json_data = file_get_contents($file_path);
            if ($json_data === false) {
                error_log("Footprint Map: 无法读取文件: {$file_path}");
                continue;
            }
            
            $data = json_decode($json_data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("Footprint Map: JSON解析错误 ({$file}): " . json_last_error_msg());
                continue;
            }
            
            if (is_array($data)) {
                if ($file === 'China-Mainland.json') {
                    // 中国大陆使用嵌套结构
                    $file_results = $this->search_in_districts($data, $search_term);
                } else {
                    // 港澳台和海外使用扁平结构
                    $file_results = $this->search_in_flat_structure($data, $search_term, $file);
                }
                $results = array_merge($results, $file_results);
            }
        }
        
        // 去重
        $unique_results = array();
        $seen_keys = array();
        foreach ($results as $result) {
            $key = $result['name'] . '|' . $result['level'];
            if (!isset($seen_keys[$key])) {
                $seen_keys[$key] = true;
                $unique_results[] = $result;
            }
        }
        
        // 简单排序：精确匹配优先，然后按级别排序
        usort($unique_results, function($a, $b) use ($search_term) {
            // 精确匹配优先
            $a_exact = (mb_strtolower($a['name']) === mb_strtolower($search_term));
            $b_exact = (mb_strtolower($b['name']) === mb_strtolower($search_term));
            if ($a_exact && !$b_exact) return -1;
            if (!$a_exact && $b_exact) return 1;
            
            // 开头匹配优先
            $a_starts = (mb_stripos($a['name'], $search_term) === 0);
            $b_starts = (mb_stripos($b['name'], $search_term) === 0);
            if ($a_starts && !$b_starts) return -1;
            if (!$a_starts && $b_starts) return 1;
            
            // 按级别排序
            $level_order = array('province' => 1, 'city' => 2, 'district' => 3);
            $a_level = isset($level_order[$a['level']]) ? $level_order[$a['level']] : 4;
            $b_level = isset($level_order[$b['level']]) ? $level_order[$b['level']] : 4;
            if ($a_level !== $b_level) return $a_level - $b_level;
            
            // 名称短的优先
            return mb_strlen($a['name']) - mb_strlen($b['name']);
        });
        
        // 限制返回20条
        return array_slice($unique_results, 0, 20);
    }
    
    private function search_in_flat_structure($data, $search_term, $file) {
        $results = array();
        foreach ($data as $item) {
            // 简单的中文名称匹配
            if (mb_stripos($item['name'], $search_term) !== false) {
                $results[] = array(
                    'name' => $item['name'],
                    'adcode' => $item['code'],
                    'center' => $item['center'],
                    'level' => $this->get_level_from_file($file),
                    'citycode' => '',
                    'english' => isset($item['english']) ? $item['english'] : '',
                    'region' => isset($item['region']) ? $item['region'] : '',
                    'pinyin' => isset($item['pinyin']) ? $item['pinyin'] : ''
                );
            }
        }
        return $results;
    }
    
    private function search_in_districts($districts, $search_term) {
        $results = array();
        foreach ($districts as $district) {
            // 简单的中文名称匹配
            if (mb_stripos($district['name'], $search_term) !== false) {
                $results[] = array(
                    'name' => $district['name'],
                    'adcode' => $district['adcode'],
                    'center' => $district['center'],
                    'level' => $district['level'],
                    'citycode' => isset($district['citycode']) ? $district['citycode'] : '',
                    'english' => '',
                    'region' => '中国大陆',
                    'pinyin' => isset($district['pinyin']) ? $district['pinyin'] : ''
                );
            }
            
            if (isset($district['districts']) && is_array($district['districts'])) {
                $sub_results = $this->search_in_districts($district['districts'], $search_term);
                $results = array_merge($results, $sub_results);
            }
        }
        return $results;
    }
    
    private function get_level_from_file($file) {
        switch ($file) {
            case 'China-HongKong.json':
                return '香港特别行政区';
            case 'China-Macau.json':
                return '澳门特别行政区';
            case 'China-Taiwan.json':
                return '台湾地区';
            case 'Global-Overseas.json':
                return '海外';
            default:
                return '未知';
        }
    }
    
    private function backup_to_webdav($cities) {
        $webdav_url = get_option('footprint_map_webdav_url');
        $username = get_option('footprint_map_webdav_username');
        $password = get_option('footprint_map_webdav_password');
        $directory = get_option('footprint_map_webdav_directory', 'footprint-map-backups');
        
        if (empty($webdav_url) || empty($username) || empty($password)) {
            error_log('Footprint Map: WebDAV配置不完整 - URL: ' . ($webdav_url ? '已设置' : '未设置') . ', 用户名: ' . ($username ? '已设置' : '未设置') . ', 密码: ' . ($password ? '已设置' : '未设置'));
            return false;
        }
        
        // 确保目录存在
        if (!empty($directory)) {
            $dir_result = $this->create_webdav_directory($webdav_url, $username, $password, $directory);
            if (!$dir_result) {
                error_log('Footprint Map: 无法创建WebDAV目录: ' . $directory);
            }
        }
        
        $data = json_encode($cities, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        // 使用固定文件名，实现自动覆盖
        $filename = !empty($directory) ? $directory . '/footprint-map-backup.json' : 'footprint-map-backup.json';
        $full_url = rtrim($webdav_url, '/') . '/' . $filename;
        
        error_log('Footprint Map: 开始WebDAV备份 - URL: ' . $full_url . ', 数据大小: ' . strlen($data) . ' 字节');
        
        $response = wp_remote_post($full_url, array(
            'method' => 'PUT',
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
                'Content-Type' => 'application/json',
                'Content-Length' => strlen($data)
            ),
            'body' => $data,
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('Footprint Map: WebDAV备份失败 - ' . $response->get_error_message());
            return false;
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        // 兼容更多WebDAV服务，PUT返回200、201、204都视为成功
        if ($code === 201 || $code === 200 || $code === 204) {
            error_log('Footprint Map: WebDAV备份成功 - HTTP状态码: ' . $code);
            return true;
        } else {
            error_log('Footprint Map: WebDAV备份失败 - HTTP状态码: ' . $code . ', 响应: ' . $body);
            return false;
        }
    }
    
    private function create_webdav_directory($webdav_url, $username, $password, $directory) {
        // 创建目录的WebDAV请求
        $response = wp_remote_request($webdav_url . $directory, array(
            'method' => 'MKCOL',
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password)
            )
        ));
        
        // 如果目录已存在，会返回405错误，这是正常的
        return !is_wp_error($response) && (wp_remote_retrieve_response_code($response) === 201 || wp_remote_retrieve_response_code($response) === 405);
    }
    
    public function activate() {
        // 检查版本要求
        footprint_map_activation_check();
        
        add_option('footprint_map_amap_key', '');
        add_option('footprint_map_amap_security_code', '');
        add_option('footprint_map_cities', array());
        add_option('footprint_map_webdav_url', '');
        add_option('footprint_map_webdav_username', '');
        add_option('footprint_map_webdav_password', '');
        add_option('footprint_map_webdav_directory', 'footprint-map-backups');
    }
    
    public function deactivate() {
        // 插件停用时的操作
    }

    public function ajax_export_json() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => '权限不足'));
            return;
        }
        
        try {
            $cities = $this->get_cities_data();
            
            if (empty($cities)) {
                // 不能直接输出错误，因为前端是XHR Blob请求，需要返回JSON错误
                // 使用 wp_send_json_error 来确保前端能正确解析错误
                status_header(400); // Bad Request
                wp_send_json(array('success' => false, 'data' => array('message' => '没有城市数据可导出')));
                return;
            }
            
            // 设置响应头
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="footprint-map-cities-' . date('Ymd-His') . '.json"');
            header('Cache-Control: no-cache, must-revalidate');
            header('Pragma: no-cache');
            
            // 输出JSON数据
            echo json_encode($cities, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            exit;
            
        } catch (Exception $e) {
            status_header(500); // Internal Server Error
            wp_send_json(array('success' => false, 'data' => array('message' => '导出失败: ' . $e->getMessage())));
        }
    }

    public function ajax_import_json() {
        check_ajax_referer('footprint_map_admin_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_die('权限不足');
        }
        $json = isset($_POST['json']) ? wp_unslash($_POST['json']) : '';
        $import = json_decode($json, true);
        if (!is_array($import)) {
            wp_send_json_error(array('message' => '导入的JSON格式不正确'));
        }
        $cities = $this->get_cities_data();
        // 合并逻辑：以adcode+center为唯一标识，避免重复
        $exists = array();
        foreach ($cities as $c) {
            $exists[$c['adcode'] . '|' . $c['center']] = true;
        }
        $added = 0;
        foreach ($import as $c) {
            $key = $c['adcode'] . '|' . $c['center'];
            if (!isset($exists[$key])) {
                $cities[] = $c;
                $exists[$key] = true;
                $added++;
            }
        }
        update_option('footprint_map_cities', $cities);
        wp_send_json_success(array('message' => '导入成功，新增 ' . $added . ' 条城市数据'));
    }

    // 异步备份处理函数
    public function async_backup_to_webdav($cities) {
        $this->backup_to_webdav($cities);
    }
}

// 初始化插件
new FootprintMap(); 