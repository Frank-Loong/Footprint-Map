<?php
/**
 * 足迹地图插件卸载文件
 * 当插件被删除时自动执行，用于清理插件数据
 * 
 * @since      1.0.0
 * @version    1.2.2
 * @package    Footprint_Map
 * @author     Frank-Loong
 * @license    GPL-3.0-or-later
 * @link       https://github.com/Frank-Loong/Footprint-Map
 */

// 防止直接访问
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// 删除插件创建的选项
delete_option('footprint_map_amap_key');
delete_option('footprint_map_amap_security_code');
delete_option('footprint_map_cities');

// 清理可能存在的其他数据
global $wpdb;

// 删除可能存在的自定义表（如果有的话）
// $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}footprint_map_data");

// 清理缓存
wp_cache_flush();

// 记录卸载日志（可选）
if (function_exists('wp_insert_log')) {
    wp_insert_log(
        '旅行足迹地图插件已卸载',
        'plugin',
        'uninstall',
        'footprint-map'
    );
} 