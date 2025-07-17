/**
 * 足迹地图前端主要JavaScript文件
 * 包含地图初始化、城市标记、交互功能等核心实现
 * 
 * @since      1.0.0
 * @version    1.2.2
 * @package    Footprint_Map
 * @author     Frank-Loong
 * @license    GPL-3.0-or-later
 * @link       https://github.com/Frank-Loong/Footprint-Map
 */

jQuery(document).ready(function($) {
    'use strict';
    
    // 全局错误处理，专门处理imgbox相关错误
    window.addEventListener('error', function(e) {
        if (e.filename && e.filename.includes('imgbox')) {
            e.preventDefault();
            return false;
        }
        
        // 忽略Canvas相关的警告
        if (e.message && (
            e.message.includes('willReadFrequently') ||
            e.message.includes('Canvas2D') ||
            e.message.includes('getImageData') ||
            e.message.includes('Cannot read properties of undefined')
        )) {
            return false;
        }
    });
    
    // 重写console.warn来过滤Canvas警告
    var originalWarn = console.warn;
    console.warn = function() {
        var args = Array.prototype.slice.call(arguments);
        var message = args.join(' ');
        
        // 过滤Canvas相关警告
        if (message.includes('willReadFrequently') || 
            message.includes('Canvas2D') || 
            message.includes('getImageData') ||
            message.includes('Avoid using document.write') ||
            message.includes('non-passive event listener')) {
            return;
        }
        
        originalWarn.apply(console, args);
    };
    
    // 检查容器是否存在
    if ($('#footprint-map-container').length === 0) return;

    // 全局变量
    var map = null;
    var currentView = 'china'; // 默认视图为中国
    var city_list = footprintMapData.cities || [];
    var mapInstance = null; // 存储地图实例
    var labelLayer = null; // 存储标签图层
    var markers = []; // 存储标记点
    var isMapLoading = false; // 防止重复加载
    var currentAMap = null; // 存储当前AMap实例
    var isCleaningUp = false; // 防止重复清理
    
    // 动态加载高德地图JSSDK
    function loadAmapApi(callback) {
        if (typeof AMapLoader !== 'undefined') {
            callback();
        return;
    }
    
        var script = document.createElement('script');
        script.src = 'https://webapi.amap.com/loader.js';
        script.async = true;
        script.defer = true;
        
        script.onload = function() {
            callback();
        };
        
        script.onerror = function() {
            handleError('高德地图加载器失败', '请检查网络连接。');
        };
        
        document.head.appendChild(script);
    }

    // 封装的初始化入口
    function start() {
    if (!footprintMapData || !footprintMapData.amapKey) {
            console.error('Footprint Map: API Key未配置或为空');
            handleError('高德地图API Key未配置', '请先在后台配置高德地图API Key');
        return;
        }
        
        window._AMapSecurityConfig = { securityJsCode: footprintMapData.amapSecurityCode || '' };
        init();
    }
    
    // 初始化
    loadAmapApi(start);
    
    function init() {
        loadMap();
    }
    
    function loadMap() {
        // 防止重复加载
        if (isMapLoading || isCleaningUp) {
            return;
        }
        
        isMapLoading = true;
        
        // 清理旧资源
        cleanupMap();
        
        // 确保容器清空并重新创建
        var containerParent = $('#footprint-map-container').parent();
        $('#footprint-map-container').remove();
        containerParent.append('<div id="footprint-map-container" style="width: 100%; height: 500px;"></div>');
        
        // 重新创建视图切换按钮
        createViewSwitcher();
        
        // 如果已经有AMap实例，直接使用
        if (currentAMap) {
            initMapWithAMap(currentAMap);
            return;
        }
        
        // 加载AMap
        AMapLoader.load({
            key: footprintMapData.amapKey,
            version: "2.0",
            plugins: ["AMap.ToolBar", "AMap.Scale", "AMap.DistrictLayer"]
        }).then(function(AMap) {
            currentAMap = AMap;
            mapInstance = AMap;
            initMapWithAMap(AMap);
        }).catch(function(e) {
            console.error('Footprint Map: AMapLoader.load失败:', e);
            handleError('高德地图加载失败', '地图加载失败，请检查API配置或网络连接');
            isMapLoading = false;
        });
    }
    
    // 使用AMap实例初始化地图
    function initMapWithAMap(AMap) {
        try {
            // 根据当前视图初始化地图
            if (currentView === 'china') {
                initChinaMap(AMap);
            } else {
                initWorldMap(AMap);
            }
        } catch (error) {
            console.error('初始化地图时出现错误:', error);
            handleError('地图初始化失败', '请刷新页面重试');
        } finally {
            isMapLoading = false;
        }
    }
    
    // 清理地图资源
    function cleanupMap() {
        // 防止重复清理
        if (isCleaningUp) {
            return;
        }
        
        isCleaningUp = true;
        
        try {
            // 清理标记点
            if (markers.length > 0) {
                markers.forEach(function(marker) {
                    try {
                        if (marker && typeof marker.remove === 'function') {
                            marker.remove();
                        }
                    } catch (e) {
                        // 静默处理清理错误
                    }
                });
                markers = [];
            }
        
            // 清理标签图层
            if (labelLayer) {
                try {
                    if (typeof labelLayer.clear === 'function') {
                        labelLayer.clear();
                    }
                    if (typeof labelLayer.remove === 'function') {
                        labelLayer.remove();
                    }
                } catch (e) {
                    // 静默处理清理错误
                }
                labelLayer = null;
            }
        
            // 清理地图实例
            if (map) {
                try {
                    // 先移除所有图层
                    if (map.getLayers && typeof map.getLayers === 'function') {
                        var layers = map.getLayers();
                        if (layers && layers.length > 0) {
                            layers.forEach(function(layer) {
                                try {
                                    if (layer && typeof layer.remove === 'function') {
                                        layer.remove();
                                    }
                                } catch (e) {
                                    // 静默处理清理错误
                                }
                            });
                        }
                    }
                    
                    // 销毁地图
                    if (typeof map.destroy === 'function') {
                        map.destroy();
                    }
                } catch (e) {
                    // 静默处理清理错误
                }
                map = null;
            }
            
            // 强制垃圾回收（如果浏览器支持）
            if (window.gc) {
                try {
                    window.gc();
                } catch (e) {
                    // 忽略垃圾回收错误
                }
            }
        } catch (e) {
            // 静默处理所有清理错误
        } finally {
            isCleaningUp = false;
        }
    }
    
    function createViewSwitcher() {
        // 移除旧的切换器以防万一
        $('#map-view-switcher').remove();

        const switcher = $(
            `<div id="map-view-switcher" style="position:absolute; top:10px; right:50px; z-index:10; background:white; padding:5px; border:1px solid #ccc; border-radius:4px;">
                <button id="china-view-btn" class="view-btn">中国</button>
                <button id="world-view-btn" class="view-btn">世界</button>
            </div>`
        );
        
        $('#footprint-map-container').append(switcher);
        
        // 更新按钮初始状态
        $('#china-view-btn').prop('disabled', currentView === 'china');
        $('#world-view-btn').prop('disabled', currentView === 'world');
        
        // 按钮样式
        $('.view-btn').css({
            'border': 'none',
            'background': '#fff',
            'cursor': 'pointer',
            'padding': '5px 10px'
        });
        $('.view-btn:disabled').css({
            'background': '#007bff',
            'color': '#fff',
            'cursor': 'default'
        });
        
        $('#china-view-btn').on('click', function() {
            if (currentView !== 'china') {
                switchView('china');
            }
        });
        
        $('#world-view-btn').on('click', function() {
            if (currentView !== 'world') {
                switchView('world');
            }
        });
    }
    
    function switchView(view) {
        // 防止重复切换
        if (currentView === view || isMapLoading || isCleaningUp) {
            return;
        }
        
        currentView = view;
        
        // 添加防抖，避免频繁切换
        clearTimeout(window.switchViewTimeout);
        window.switchViewTimeout = setTimeout(function() {
            try {
                loadMap();
            } catch (e) {
                console.error('切换视图时出现错误:', e);
                isMapLoading = false;
            }
        }, 200); // 增加延迟时间，确保清理完成
    }
    
    function initChinaMap(AMap) {
    var colors = {};
        
        // 自动计算标签方向的函数
        function calculateLabelDirection(city, allCities) {
            if (!city.center) return 'center';
            
            var coords = city.center.split(',');
            var lng = parseFloat(coords[0]);
            var lat = parseFloat(coords[1]);
            
            if (isNaN(lat) || isNaN(lng)) return 'center';
            
            // 获取当前地图缩放级别，用于动态调整避让策略
            var currentZoom = map ? map.getZoom() : 4;
            var zoomFactor = Math.max(0.5, Math.min(2, currentZoom / 4)); // 缩放因子，影响避让强度
            
            // 标签大小估算（根据城市名称长度和缩放级别）
            var labelWidth = Math.max(40, city.name.length * 8 * zoomFactor);
            var labelHeight = 20 * zoomFactor;
            
            // 方向权重初始化
            var scores = { 
                top: 0, 
                right: 0, 
                bottom: 0, 
                left: 0, 
                center: 0 
            };
            
            // 第一轮：检查近距离冲突（更严格的阈值）
            var closeThreshold = 0.15 * zoomFactor; // 动态阈值
            var mediumThreshold = 0.25 * zoomFactor;
            
            allCities.forEach(function(otherCity) {
                if (otherCity.name === city.name || !otherCity.center) return;
                
                var otherCoords = otherCity.center.split(',');
                var otherLng = parseFloat(otherCoords[0]);
                var otherLat = parseFloat(otherCoords[1]);
                
                if (isNaN(otherLat) || isNaN(otherLng)) return;
                
                // 更精确的距离计算（考虑地球曲率）
                var distance = calculateDistance(lng, lat, otherLng, otherLat);
                
                if (distance < closeThreshold) {
                    // 极近距离，强制避让
                    var weight = 10 / (distance + 0.001);
                    applyDirectionalPenalty(scores, lng, lat, otherLng, otherLat, weight);
                } else if (distance < mediumThreshold) {
                    // 中等距离，适度避让
                    var weight = 3 / (distance + 0.01);
                    applyDirectionalPenalty(scores, lng, lat, otherLng, otherLat, weight);
                }
            });
            
            // 第二轮：边界检查（更严格）
            var boundaryMargin = 0.02; // 边界安全距离
            if (lat > 45 - boundaryMargin) scores.top -= 5;
            if (lat < 20 + boundaryMargin) scores.bottom -= 5;
            if (lng > 130 - boundaryMargin) scores.right -= 5;
            if (lng < 80 + boundaryMargin) scores.left -= 5;
            
            // 第三轮：特殊区域处理
            if (lng > 120 && lat > 30) {
                // 东部沿海密集区
                scores.top -= 3;
                scores.bottom -= 3;
                scores.center -= 1;
            }
            if (lng < 90 && lat > 35) {
                // 西北地区
                scores.left -= 3;
                scores.right -= 3;
                scores.center -= 1;
            }
            if (lng > 100 && lng < 120 && lat > 25 && lat < 45) {
                // 中部密集区
                scores.center -= 2;
            }
            
            // 第四轮：智能避让策略
            var minScore = Math.min(scores.top, scores.right, scores.bottom, scores.left, scores.center);
            var maxScore = Math.max(scores.top, scores.right, scores.bottom, scores.left, scores.center);
            
            if (minScore < -8) {
                // 极端冲突情况：强制选择最佳方向
                var bestDirection = 'center';
                var bestScore = -Infinity;
                
                for (var dir in scores) {
                    if (scores[dir] > bestScore) {
                        bestScore = scores[dir];
                        bestDirection = dir;
                    }
                }
                
                // 如果所有方向都很差，使用center并调整位置
                if (bestScore < -5) {
                    return 'center';
                }
                
                return bestDirection;
            } else if (maxScore - minScore < 2) {
                // 所有方向得分相近，优先选择center
                return 'center';
            } else {
                // 正常情况：选择得分最高的方向
            var bestDirection = 'center';
            var bestScore = -Infinity;
            
            for (var dir in scores) {
                if (scores[dir] > bestScore) {
                    bestScore = scores[dir];
                    bestDirection = dir;
                }
            }
            
            return bestDirection;
            }
        }
        
        // 辅助函数：计算两点间距离（考虑地球曲率）
        function calculateDistance(lng1, lat1, lng2, lat2) {
            var R = 6371; // 地球半径（公里）
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var distance = R * c;
            
            // 转换为度（近似）
            return distance / 111;
        }
        
        // 辅助函数：应用方向惩罚
        function applyDirectionalPenalty(scores, lng1, lat1, lng2, lat2, weight) {
            var deltaLng = lng2 - lng1;
            var deltaLat = lat2 - lat1;
            
            // 计算角度
            var angle = Math.atan2(deltaLat, deltaLng) * 180 / Math.PI;
            
            // 根据角度分配惩罚
            if (angle >= -45 && angle < 45) {
                scores.right -= weight; // 右方
            } else if (angle >= 45 && angle < 135) {
                scores.top -= weight; // 上方
            } else if (angle >= 135 || angle < -135) {
                scores.left -= weight; // 左方
            } else {
                scores.bottom -= weight; // 下方
            }
        }
        
        // 辅助函数：计算位置偏移
        function calculatePositionOffset(lng, lat, direction, cityName) {
            var offset = { lng: lng, lat: lat };
            var baseOffset = 0.01; // 基础偏移量
            var nameLength = cityName.length;
            var lengthFactor = Math.min(1.5, Math.max(0.5, nameLength / 4)); // 根据名称长度调整
            
            // 获取当前缩放级别
            var currentZoom = map ? map.getZoom() : 4;
            var zoomFactor = Math.max(0.3, Math.min(1.5, currentZoom / 4));
            
            var adjustedOffset = baseOffset * lengthFactor * zoomFactor;
            
            switch (direction) {
                case 'top':
                    offset.lat += adjustedOffset;
                    break;
                case 'bottom':
                    offset.lat -= adjustedOffset;
                    break;
                case 'left':
                    offset.lng -= adjustedOffset;
                    break;
                case 'right':
                    offset.lng += adjustedOffset;
                    break;
                case 'center':
                default:
                    // center不偏移，但可以微调以避免完全重叠
                    if (nameLength > 6) {
                        offset.lat += adjustedOffset * 0.3;
                    }
                    break;
            }
            
            return offset;
        }
        
        // 辅助函数：检测冲突级别
        function detectConflictLevel(city, allCities) {
            if (!city.center) return 0;
            
            var coords = city.center.split(',');
            var lng = parseFloat(coords[0]);
            var lat = parseFloat(coords[1]);
            
            if (isNaN(lat) || isNaN(lng)) return 0;
            
            var conflictCount = 0;
            var totalDistance = 0;
            
            allCities.forEach(function(otherCity) {
                if (otherCity.name === city.name || !otherCity.center) return;
                
                var otherCoords = otherCity.center.split(',');
                var otherLng = parseFloat(otherCoords[0]);
                var otherLat = parseFloat(otherCoords[1]);
                
                if (isNaN(otherLat) || isNaN(otherLng)) return;
                
                var distance = calculateDistance(lng, lat, otherLng, otherLat);
                
                if (distance < 0.1) {
                    conflictCount++;
                    totalDistance += distance;
                }
            });
            
            if (conflictCount === 0) return 0;
            if (conflictCount >= 3) return 3; // 高冲突
            if (conflictCount >= 2) return 2; // 中冲突
            return 1; // 低冲突
        }
        
        // 辅助函数：根据冲突级别获取标签样式
        function getLabelStyle(conflictLevel, cityName) {
            var baseStyle = {
                fontSize: 12,
                fontWeight: 'normal',
                fillColor: '#333',
                strokeColor: '#fff',
                strokeWidth: 2,
            };
            
            switch (conflictLevel) {
                case 3: // 高冲突
                    return {
                        fontSize: 10,
                        fontWeight: 'bold',
                        fillColor: '#d32f2f',
                        strokeColor: '#fff',
                        strokeWidth: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: [2, 4]
                    };
                case 2: // 中冲突
                    return {
                        fontSize: 11,
                        fontWeight: 'bold',
                        fillColor: '#f57c00',
                        strokeColor: '#fff',
                        strokeWidth: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        padding: [1, 3]
                    };
                case 1: // 低冲突
                    return {
                        fontSize: 11,
                        fontWeight: 'normal',
                        fillColor: '#1976d2',
                        strokeColor: '#fff',
                        strokeWidth: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                        padding: [1, 2]
                    };
                default: // 无冲突
                    return baseStyle;
            }
        }

        var getColorByDGP = function(adcode){
            if(!adcode) return 'rgb(202,235,216)';
            if(!colors[adcode]){
                var cityData = city_list.find(function(city) {
                    return parseInt(city.adcode) === parseInt(adcode);
                });
                if(!cityData){
                colors[adcode] = 'rgb(202,235,216)';
            } else {
                    var opacity = cityData.opacity || 8;
                var r = 255;
                var g = 125;
                var b = 64;
                    var a = opacity/10;
                    colors[adcode] = 'rgba('+ r +','+ g +','+b+','+a+')';
            }
        }
        return colors[adcode];
    };
    
        try {
            var disCountry = new AMap.DistrictLayer.Province({
                zIndex:10,
                SOC:'CHN',
                depth:1,
                styles:{
                    'nation-stroke':'#ff0000',
                    'coastline-stroke':'#0088ff',
                    'province-stroke':'grey',
                    'fill':function(props){
                       var adcode = props.adcode_cit || props.adcode;
                       return getColorByDGP(adcode);
                    }
                },
            });

            map = new AMap.Map("footprint-map-container",{
                zooms: [4, 10],
                center:[106.122082, 33.719192],
                zoom: 4,
                isHotspot:false,
                defaultCursor:'pointer',
                layers:[ disCountry ],
                viewMode:'3D',
                mapStyle: 'amap://styles/whitesmoke',
                // 添加Canvas优化设置
                renderMode: '2D', // 使用2D渲染模式，减少Canvas警告
                preloadMode: false, // 禁用预加载，减少内存使用
                expandZoomRange: false, // 禁用扩展缩放范围
                jogEnable: false, // 禁用抖动效果
                animateEnable: false, // 禁用动画效果，减少Canvas操作
                dragEnable: true,
                zoomEnable: true,
                doubleClickZoom: true,
                keyboardEnable: false, // 禁用键盘控制
                jogEnable: false, // 禁用抖动
                scrollWheel: true,
                touchZoom: true,
                showIndoorMap: false, // 禁用室内地图
                // 添加性能优化设置
                resizeEnable: false, // 禁用自动调整大小
                autoResize: false, // 禁用自动调整大小
                lazyLoad: true, // 启用懒加载
                // 添加Canvas优化
                canvas: {
                    willReadFrequently: true // 设置Canvas优化属性
                }
            });
            
            // 优化Canvas设置
            if (map.getContainer) {
                var container = map.getContainer();
                if (container && container.querySelector) {
                    var canvas = container.querySelector('canvas');
                    if (canvas) {
                        // 设置Canvas优化属性
                        canvas.setAttribute('willReadFrequently', 'true');
                        // 添加其他Canvas优化
                        canvas.style.imageRendering = 'optimizeSpeed';
                        canvas.style.imageRendering = '-moz-crisp-edges';
                        canvas.style.imageRendering = '-webkit-optimize-contrast';
                    }
                }
            }
            
            addControls(AMap);

            labelLayer = new AMap.LabelsLayer({
                collision: false,
                animation: false, // 禁用动画，减少Canvas操作
            });

            var lastInfoWindow;
            // 只渲染中国大陆、港澳台城市，排除海外
            var chinaCities = city_list.filter(function(city) {
                return !isOverseas(city.adcode);
            });
            
            chinaCities.forEach(function(city) {
                if (!city.center) return;
                var coords = city.center.split(',');
                var lng = parseFloat(coords[0]);
                var lat = parseFloat(coords[1]);
                if (isNaN(lat) || isNaN(lng)) return;
                
                // 自动计算标签方向
                var labelDirection = calculateLabelDirection(city, chinaCities);
                
                // 根据方向微调标签位置
                var positionOffset = calculatePositionOffset(lng, lat, labelDirection, city.name);
                
                // 检测冲突并调整样式
                var conflictLevel = detectConflictLevel(city, chinaCities);
                var labelStyle = getLabelStyle(conflictLevel, city.name);
                
                var labelMarker = new AMap.LabelMarker({
                    position: [positionOffset.lng, positionOffset.lat],
                    extData: {
                        name: generateModernDescription(city)
                    },
                    text: {
                        content: city.name,
                        direction: labelDirection,
                        style: labelStyle
                    }
                });
                
                labelMarker.on('click', function(e){
                    if (lastInfoWindow) lastInfoWindow.close();
                    
                    var infoWindow = new AMap.InfoWindow({
                        content: e.target.getExtData().name,
                        anchor: "bottom-center",
                        offset: new AMap.Pixel(0, -10),
                        autoMove: true, // 启用自动移动
                        closeWhenClickMap: true, // 点击地图时关闭
                        // 使用固定大小
                        size: new AMap.Size(300, 350)
                    });
                    
                    // 获取点击位置
                    var clickPosition = e.target.getPosition();
                    
                    // 确保信息窗口在可视范围内
                    var mapBounds = map.getBounds();
                    if (mapBounds) {
                        var ne = mapBounds.getNorthEast();
                        var sw = mapBounds.getSouthWest();
                        
                        // 计算信息窗口的边界
                        var windowOffset = 175; // 窗口高度的一半（350/2）
                        var windowLng = clickPosition.getLng();
                        var windowLat = clickPosition.getLat() + (windowOffset / 111000); // 转换为度
                        
                        // 如果信息窗口会超出地图边界，调整位置
                        if (windowLat > ne.getLat()) {
                            // 如果超出上边界，将窗口显示在标记点下方
                            infoWindow.setAnchor("top-center");
                            infoWindow.setOffset(new AMap.Pixel(0, 10));
                        }
                        
                        // 检查左右边界
                        if (windowLng < sw.getLng() || windowLng > ne.getLng()) {
                            // 如果超出左右边界，调整地图视野
                            map.panTo(clickPosition);
                        }
                    }
                    
                    infoWindow.open(map, clickPosition);
                    lastInfoWindow = infoWindow;
                    
                    // 重新绑定图片点击事件
                    $(infoWindow.getContent()).find('.city-image').off('click').on('click', function(e) {
                        e.stopPropagation();
                        
                        var $imageContainer = $(this);
                        var $imagesContainer = $imageContainer.closest('.city-images');
                        
                        // 获取点击的图片在所有图片中的实际索引
                        var clickedIndex = $imagesContainer.find('.city-image').index($imageContainer);
                        
                        // 收集所有图片信息
                        var images = [];
                        $imagesContainer.find('.city-image').each(function(index) {
                            var $img = $(this);
                            var $imgTag = $img.find('img');
                            var imageUrl = $img.data('image-url') || $imgTag.attr('src');
                            var imageAlt = $imgTag.attr('alt') || '';
                            
                            // 确保图片URL有效
                            if (imageUrl && imageUrl.trim()) {
                                images.push({
                                    url: imageUrl.trim(),
                                    alt: imageAlt
                                });
                            }
                        });
                        
                        // 确保有有效的图片数据
                        if (images.length === 0) {
                            return;
                        }
                        
                        // 确保点击索引在有效范围内
                        if (clickedIndex < 0 || clickedIndex >= images.length) {
                            clickedIndex = 0;
                        }
                        
                        // 调用全局的showModal函数
                        if (window.showImageModal) {
                            window.showImageModal(images, clickedIndex);
                        } else if (typeof showModal === 'function') {
                            showModal(images, clickedIndex);
                        }
                    });
                });
                
                labelLayer.add(labelMarker);
            });
            
            map.add(labelLayer);

            map.on('click', function() {
                if (lastInfoWindow) {
                    lastInfoWindow.close();
                }
            });
        } catch (error) {
            console.error('初始化中国地图时出现错误:', error);
            handleError('地图初始化失败', '请刷新页面重试');
        }
    }
    
    function initWorldMap(AMap) {
        map = new AMap.Map("footprint-map-container", {
            zooms: [2, 10],
            center: [20, 30],
            zoom: 2,
            isHotspot: false,
            defaultCursor: 'pointer',
            viewMode: '3D',
            mapStyle: 'amap://styles/normal',
            // 添加Canvas优化设置
            renderMode: '2D', // 使用2D渲染模式，减少Canvas警告
            preloadMode: false, // 禁用预加载，减少内存使用
            expandZoomRange: false, // 禁用扩展缩放范围
            jogEnable: false, // 禁用抖动效果
            animateEnable: false, // 禁用动画效果，减少Canvas操作
            dragEnable: true,
            zoomEnable: true,
            doubleClickZoom: true,
            keyboardEnable: false, // 禁用键盘控制
            scrollWheel: true,
            touchZoom: true,
            showIndoorMap: false, // 禁用室内地图
            // 添加性能优化设置
            resizeEnable: false, // 禁用自动调整大小
            autoResize: false, // 禁用自动调整大小
            lazyLoad: true, // 启用懒加载
            // 添加Canvas优化
            canvas: {
                willReadFrequently: true // 设置Canvas优化属性
            }
        });
        
        // 优化Canvas设置
        if (map.getContainer) {
            var container = map.getContainer();
            if (container && container.querySelector) {
                var canvas = container.querySelector('canvas');
                if (canvas) {
                    // 设置Canvas优化属性
                    canvas.setAttribute('willReadFrequently', 'true');
                    // 添加其他Canvas优化
                    canvas.style.imageRendering = 'optimizeSpeed';
                    canvas.style.imageRendering = '-moz-crisp-edges';
                    canvas.style.imageRendering = '-webkit-optimize-contrast';
                }
            }
        }
        
        addControls(AMap);

        var markers = [];
        var lastInfoWindow;
        city_list.forEach(function(city) {
            if (!city.center) return;
            var coords = city.center.split(',');
            var lng = parseFloat(coords[0]);
            var lat = parseFloat(coords[1]);
            if (isNaN(lat) || isNaN(lng)) return;

            var marker = new AMap.Marker({
                position: new AMap.LngLat(lng, lat),
                extData: {
                    name: generateModernDescription(city)
                }
            });

            marker.on('click', function(e) {
                if (lastInfoWindow) {
                    lastInfoWindow.close();
                }
                
                var infoWindow = new AMap.InfoWindow({
                    content: e.target.getExtData().name,
                    anchor: "bottom-center",
                    offset: new AMap.Pixel(0, -10),
                    autoMove: true, // 启用自动移动
                    closeWhenClickMap: true, // 点击地图时关闭
                    // 使用固定大小
                    size: new AMap.Size(300, 350)
                });
                
                // 获取点击位置
                var clickPosition = e.target.getPosition();
                
                // 确保信息窗口在可视范围内
                var mapBounds = map.getBounds();
                if (mapBounds) {
                    var ne = mapBounds.getNorthEast();
                    var sw = mapBounds.getSouthWest();
                    
                    // 计算信息窗口的边界
                    var windowOffset = 175; // 窗口高度的一半（350/2）
                    var windowLng = clickPosition.getLng();
                    var windowLat = clickPosition.getLat() + (windowOffset / 111000); // 转换为度
                    
                    // 如果信息窗口会超出地图边界，调整位置
                    if (windowLat > ne.getLat()) {
                        // 如果超出上边界，将窗口显示在标记点下方
                        infoWindow.setAnchor("top-center");
                        infoWindow.setOffset(new AMap.Pixel(0, 10));
                    }
                    
                    // 检查左右边界
                    if (windowLng < sw.getLng() || windowLng > ne.getLng()) {
                        // 如果超出左右边界，调整地图视野
                        map.panTo(clickPosition);
                    }
                }
                
                infoWindow.open(map, clickPosition);
                lastInfoWindow = infoWindow;
                
                // 重新绑定图片点击事件
                $(infoWindow.getContent()).find('.city-image').off('click').on('click', function(e) {
                    e.stopPropagation();
                    
                    var $imageContainer = $(this);
                    var $imagesContainer = $imageContainer.closest('.city-images');
                    
                    // 获取点击的图片在所有图片中的实际索引
                    var clickedIndex = $imagesContainer.find('.city-image').index($imageContainer);
                    
                    // 收集所有图片信息
                    var images = [];
                    $imagesContainer.find('.city-image').each(function(index) {
                        var $img = $(this);
                        var $imgTag = $img.find('img');
                        var imageUrl = $img.data('image-url') || $imgTag.attr('src');
                        var imageAlt = $imgTag.attr('alt') || '';
                        
                        // 确保图片URL有效
                        if (imageUrl && imageUrl.trim()) {
                            images.push({
                                url: imageUrl.trim(),
                                alt: imageAlt
                            });
                        }
                    });
                    
                    // 确保有有效的图片数据
                    if (images.length === 0) {
                        return;
                    }
                    
                    // 确保点击索引在有效范围内
                    if (clickedIndex < 0 || clickedIndex >= images.length) {
                        clickedIndex = 0;
                    }
                    
                    // 调用全局的showModal函数
                    if (window.showImageModal) {
                        window.showImageModal(images, clickedIndex);
                    } else if (typeof showModal === 'function') {
                        showModal(images, clickedIndex);
                    }
                });
            });
            markers.push(marker);
        });
        map.add(markers);

        map.on('click', function() {
            if (lastInfoWindow) {
                lastInfoWindow.close();
            }
        });
    }
    
    function addControls(AMap) {
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ liteStyle: true }));
    }
    
    function handleError(title, message) {
        $('#footprint-map-container').html(`<p style="text-align: center; color: #666; font-weight:bold;">${title}</p><p style="text-align: center; color: #666;">${message}</p>`);
    }

    function generateModernDescription(city) {
        // 检查desc字段是否已经包含完整的HTML结构
        if (city.desc && city.desc.includes('<div class="city-info">')) {
            // 如果desc已经包含完整结构，直接返回
            return city.desc;
        }
        
        let desc = '';
        // 只生成一次城市名和标签
        if (city.name) {
            desc += `<h3 class="city-name">${city.name}</h3>`;
        }
        if (city.tags) {
            const tagArray = city.tags.split(',').map(tag => tag.trim());
            desc += `<div class="city-tags">`;
            tagArray.forEach((tag, index) => {
                desc += `<span class="tag" style="--tag-index: ${index}">${tag}</span>`;
            });
            desc += `</div>`;
        }
        
        // 处理时间段数据
        if (city.date_start && city.date_end) {
            const startDate = new Date(city.date_start);
            const endDate = new Date(city.date_end);
            
            if (city.is_date_range && city.date_start !== city.date_end) {
                // 时间段显示
                const startFormatted = startDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const endFormatted = endDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                desc += `<div class="visit-date"><i class="dashicons dashicons-calendar"></i> ${startFormatted} - ${endFormatted}</div>`;
            } else {
                // 单日显示
                const formattedDate = startDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                desc += `<div class="visit-date"><i class="dashicons dashicons-calendar"></i> ${formattedDate}</div>`;
            }
        } else if (city.date) {
            // 兼容旧数据格式
            const dateObj = new Date(city.date);
            const formattedDate = dateObj.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            desc += `<div class="visit-date"><i class="dashicons dashicons-calendar"></i> ${formattedDate}</div>`;
        }
        
        desc += `<div class="city-description">`;
        if (city.desc && city.desc.indexOf('在这里记录您对') === -1) {
            if (window.marked && typeof marked.parse === 'function') {
                try {
                    desc += marked.parse(city.desc);
                } catch (e) {
            desc += city.desc;
                }
        } else {
                desc += city.desc;
            }
        } else if(!city.desc) {
            desc += `<p>在这里记录您对${city.name}的美好回忆...</p>`;
        }
        desc += `</div>`;
        
        // 只有当desc字段不包含图片时才添加图片
        if (city.image && (!city.desc || !city.desc.includes('<img'))) {
            const imageUrls = city.image.split(',').map(url => url.trim()).filter(url => url);
            if (imageUrls.length > 0) {
                desc += `<div class="city-images" data-count="${imageUrls.length}">`;
                imageUrls.forEach((imageUrl, index) => {
                    desc += `<div class="city-image" data-image-index="${index}" data-image-url="${imageUrl}">`;
                    desc += `<img src="${imageUrl}" alt="${city.name} - 图片${index + 1}" loading="lazy" data-no-imgbox="true" data-imgbox="false">`;
                    desc += `</div>`;
                });
            desc += `</div>`;
            }
        }
        
        return `<div class="city-info">${desc}</div>`;
    }

    // 在页面加载时动态引入marked.js
    (function() {
        if (!window.marked) {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            document.head.appendChild(script);
        }
        
        // 禁用imgbox对插件图片的处理
        function disableImgboxForPlugin() {
            // 为所有插件内的图片添加禁用属性
            $('#footprint-map-container img').each(function() {
                $(this).attr('data-no-imgbox', 'true');
                $(this).attr('data-imgbox', 'false');
            });
        }
        
        // 立即执行一次
        disableImgboxForPlugin();
        
        // 如果imgbox已加载，监听其初始化事件
        if (window.imgbox) {
            $(document).on('imgbox:init', function() {
                disableImgboxForPlugin();
            });
        }
        
        // 监听DOM变化，确保新添加的图片也被排除
        if (window.MutationObserver) {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1) {
                                // 检查节点本身
                                if (node.matches && node.matches('#footprint-map-container img')) {
                                    node.setAttribute('data-no-imgbox', 'true');
                                    node.setAttribute('data-imgbox', 'false');
                                }
                                // 检查子节点
                                if (node.querySelectorAll) {
                                    var images = node.querySelectorAll('#footprint-map-container img');
                                    images.forEach(function(img) {
                                        img.setAttribute('data-no-imgbox', 'true');
                                        img.setAttribute('data-imgbox', 'false');
                                    });
                                }
                            }
                        });
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        // 重写imgbox的初始化函数，排除插件图片
        if (window.imgbox && typeof window.imgbox.init === 'function') {
            var originalInit = window.imgbox.init;
            window.imgbox.init = function(selector) {
                // 排除插件内的图片
                var filteredSelector = selector + ':not([data-no-imgbox="true"]):not([data-imgbox="false"])';
                return originalInit.call(this, filteredSelector);
            };
        }
    })();
    
    // 判断是否为海外城市
    function isOverseas(adcode) {
        if (!adcode) return false;
        // 中国大陆的adcode是6位数字，以1-9开头
        // 港澳台和海外使用不同的编码格式
        var code = adcode.toString();
        if (code.length === 6 && /^[1-9]/.test(code)) {
            return false; // 中国大陆
        }
        return true; // 港澳台或海外
    }
    
    // 图片查看功能
    function initImageModal() {
        // 创建模态框
        var modal = $(
            `<div class="image-modal">
                <button class="close-modal">&times;</button>
                <img src="" alt="">
                <div class="image-counter"></div>
                <button class="nav-btn prev">‹</button>
                <button class="nav-btn next">›</button>
            </div>`
        );
        
        $('body').append(modal);
        
        var currentImages = [];
        var currentIndex = 0;
        
        // 关闭模态框
        modal.on('click', function(e) {
            if (e.target === this || $(e.target).hasClass('close-modal')) {
                hideModal();
            }
        });
        
        // 导航按钮
        modal.find('.nav-btn.prev').on('click', function(e) {
            e.stopPropagation();
            showPrevImage();
        });
        
        modal.find('.nav-btn.next').on('click', function(e) {
            e.stopPropagation();
            showNextImage();
        });
        
        // 键盘导航
        $(document).on('keydown', function(e) {
            if (modal.is(':visible')) {
                switch(e.keyCode) {
                    case 27: // ESC
                        hideModal();
                        break;
                    case 37: // 左箭头
                        showPrevImage();
                        break;
                    case 39: // 右箭头
                        showNextImage();
                        break;
                }
            }
        });
        
        function showModal(images, startIndex) {
            // 验证参数
            if (!images || !Array.isArray(images) || images.length === 0) {
                return;
            }
            
            // 确保startIndex在有效范围内
            if (startIndex < 0 || startIndex >= images.length) {
                startIndex = 0;
            }
            
            currentImages = images;
            currentIndex = startIndex;
            updateModal();
            modal.fadeIn(300);
        }
        
        // 暴露为全局函数，供信息窗口调用
        window.showImageModal = showModal;
        
        function hideModal() {
            modal.fadeOut(300);
        }
        
        function updateModal() {
            if (currentImages.length === 0) return;
            
            // 确保索引在有效范围内
            if (currentIndex < 0 || currentIndex >= currentImages.length) {
                currentIndex = 0;
            }
            
            var image = currentImages[currentIndex];
            if (!image || !image.url) {
                return;
            }
            
            modal.find('img').attr('src', image.url).attr('alt', image.alt || '');
            modal.find('.image-counter').text((currentIndex + 1) + ' / ' + currentImages.length);
            
            // 显示/隐藏导航按钮
            modal.find('.nav-btn.prev').toggle(currentIndex > 0);
            modal.find('.nav-btn.next').toggle(currentIndex < currentImages.length - 1);
        }
        
        function showPrevImage() {
            if (currentIndex > 0) {
                currentIndex--;
                updateModal();
            }
        }
        
        function showNextImage() {
            if (currentIndex < currentImages.length - 1) {
                currentIndex++;
                updateModal();
            }
        }
        
        // 绑定图片点击事件
        $(document).on('click', '.city-image', function(e) {
            e.stopPropagation();
            
            var $imageContainer = $(this);
            var $imagesContainer = $imageContainer.closest('.city-images');
            
            // 获取点击的图片在所有图片中的实际索引
            var clickedIndex = $imagesContainer.find('.city-image').index($imageContainer);
            
            // 收集所有图片信息
            var images = [];
            $imagesContainer.find('.city-image').each(function(index) {
                var $img = $(this);
                var $imgTag = $img.find('img');
                var imageUrl = $img.data('image-url') || $imgTag.attr('src');
                var imageAlt = $imgTag.attr('alt') || '';
                
                // 确保图片URL有效
                if (imageUrl && imageUrl.trim()) {
                    images.push({
                        url: imageUrl.trim(),
                        alt: imageAlt
                    });
                }
            });
            
            // 确保有有效的图片数据
            if (images.length === 0) {
                return;
            }
            
            // 确保点击索引在有效范围内
            if (clickedIndex < 0 || clickedIndex >= images.length) {
                clickedIndex = 0;
            }
            
            showModal(images, clickedIndex);
        });
    }
    
    // 初始化图片查看功能
    initImageModal();
});