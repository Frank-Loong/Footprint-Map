/**
 * 足迹地图管理后台JavaScript文件
 * 包含城市管理、数据导入导出、备份恢复等管理功能
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
    
    // =========================================================================
    // 侧边菜单切换功能
    // =========================================================================
    
    function initSidebarNavigation() {
        // 菜单项点击事件
        $('.nav-item').on('click', function(e) {
            e.preventDefault();
            
            const targetTab = $(this).data('tab');
            
            // 更新菜单项状态
            $('.nav-item').removeClass('active');
            $(this).addClass('active');
            
            // 切换内容面板
            $('.content-panel').removeClass('active');
            $('#' + targetTab).addClass('active');
            
            // 如果是城市列表，重新加载数据
            if (targetTab === 'city-list') {
                loadCities();
            }
            
            // 更新URL哈希（可选）
            window.location.hash = targetTab;
        });
        
        // 页面加载时根据URL哈希设置默认标签页
        const hash = window.location.hash.substring(1);
        if (hash && $('#' + hash).length) {
            $('.nav-item').removeClass('active');
            $('[data-tab="' + hash + '"]').addClass('active');
            $('.content-panel').removeClass('active');
            $('#' + hash).addClass('active');
        }
        
        // 城市列表搜索功能
        $('#city-list-search').on('input', function() {
            const searchTerm = $(this).val().toLowerCase();
            filterCities(searchTerm);
        });
        
        // 城市列表筛选功能
        $('.filter-btn').on('click', function() {
            const filter = $(this).data('filter');
            
            // 更新按钮状态
            $('.filter-btn').removeClass('active');
            $(this).addClass('active');
            
            // 应用筛选
            applyCityFilter(filter);
        });
    }
    
    function filterCities(searchTerm) {
        if (!allCities || allCities.length === 0) return;
        
        const filteredCities = allCities.filter(function(city) {
            return city.name.toLowerCase().includes(searchTerm) ||
                   city.adcode.includes(searchTerm) ||
                   (city.tags && city.tags.toLowerCase().includes(searchTerm));
        });
        
        renderFilteredCities(filteredCities);
    }
    
    function applyCityFilter(filter) {
        if (!allCities || allCities.length === 0) return;
        
        let filteredCities = [];
        
        switch (filter) {
            case 'recent':
                // 最近添加的城市（最近30天）
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                filteredCities = allCities.filter(function(city) {
                    const cityDate = new Date(city.created_at);
                    return cityDate >= thirtyDaysAgo;
                });
                break;
                
            case 'tagged':
                // 有标签的城市
                filteredCities = allCities.filter(function(city) {
                    return city.tags && city.tags.trim() !== '';
                });
                break;
                
            case 'all':
            default:
                filteredCities = allCities;
                break;
        }
        
        renderFilteredCities(filteredCities);
    }
    
    function renderFilteredCities(cities) {
        const container = $('#cities-container');
        container.empty();
        
        if (cities.length === 0) {
            container.html('<p class="no-cities-search">没有找到匹配的城市</p>');
            return;
        }
        
        // 渲染筛选后的城市列表
        cities.forEach(function(city, index) {
            const cityElement = $(`
                <div class="city-item" data-index="${index}">
                    <div class="city-header">
                        <h4 class="city-title">${city.name}</h4>
                        <div class="city-actions">
                            <button type="button" class="button edit-city" title="编辑">编辑</button>
                            <button type="button" class="button delete-city" title="删除">删除</button>
                        </div>
                    </div>
                    <div class="city-details">
                        <div class="detail-item">
                            <span class="label">编码:</span>
                            <span class="value">${city.adcode}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">坐标:</span>
                            <span class="value">${city.center}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">透明度:</span>
                            <span class="value">${city.opacity}/10</span>
                        </div>
                        ${city.tags ? `<div class="detail-item">
                            <span class="label">标签:</span>
                            <span class="value">${city.tags}</span>
                        </div>` : ''}
                        ${(city.date_start && city.date_end) ? `<div class="detail-item">
                            <span class="label">访问日期:</span>
                            <span class="value">${formatCityDate(city)}</span>
                        </div>` : (city.date ? `<div class="detail-item">
                            <span class="label">访问日期:</span>
                            <span class="value">${city.date}</span>
                        </div>` : '')}
                        <div class="detail-item">
                            <span class="label">添加时间:</span>
                            <span class="value">${formatDate(city.created_at)}</span>
                        </div>
                    </div>
                </div>
            `);
            
            cityElement.find('.edit-city').on('click', function() {
                editCity(city, index);
                // 切换到城市管理标签页
                $('.nav-item[data-tab="city-management"]').click();
            });
            
            cityElement.find('.delete-city').on('click', function() {
                if (confirm('确定要删除这个城市吗？')) {
                    performAjaxRequest('delete_city', { index: index }, $(this), '删除中...', '删除');
                }
            });
            
            container.append(cityElement);
        });
    }
    
    // =========================================================================
    // 地图相关变量
    // =========================================================================
    let map = null;
    let currentBoundary = null;
    
    // =========================================================================
    // 辅助函数
    // =========================================================================

    function showMessage(message, type = 'info', duration = 3000) {
        let toastContainer = $('#footprint-map-toast-container');
        if (toastContainer.length === 0) {
            $('body').append('<div id="footprint-map-toast-container"></div>');
            toastContainer = $('#footprint-map-toast-container');
        }
        
        // 限制同时显示的消息数量
        if (toastContainer.children().length >= 3) {
            toastContainer.children().first().remove();
        }
        
        const toast = $(`<div class="footprint-map-toast ${type}">${message}</div>`);
        toastContainer.append(toast);
        toast.fadeIn(300);
        
        setTimeout(() => {
            toast.fadeOut(500, function() { 
                $(this).remove(); 
            });
        }, duration);
    }

    function performAjaxRequest(action, data, buttonElement, loadingText, originalText) {
        if (!buttonElement || !buttonElement.length) {
            return;
        }
        
        buttonElement.prop('disabled', true).text(loadingText);

        const ajaxData = {
            action: `footprint_map_${action}`,
            nonce: footprintMapAdmin.nonce,
            ...data
        };

        $.ajax({
            url: footprintMapAdmin.ajaxUrl,
            type: 'POST',
            data: ajaxData,
            timeout: 30000,
            success: function(response) {
                if (response.success) {
                    showMessage(response.data.message, 'success');
                    if (['save_city', 'delete_city', 'import_json', 'restore_webdav', 'update_city'].includes(action)) {
                        loadCities();
                    }
                    if (['save_city', 'update_city'].includes(action)) {
                        clearForm();
                    }
                } else {
                    showMessage(response.data.message || '操作失败，未知错误', 'error');
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                let errorMsg = '网络错误';
                if (textStatus === 'timeout') {
                    errorMsg = '请求超时，请重试';
                } else if (jqXHR.responseJSON && jqXHR.responseJSON.data && jqXHR.responseJSON.data.message) {
                    errorMsg = jqXHR.responseJSON.data.message;
                } else if (jqXHR.statusText) {
                    errorMsg = jqXHR.statusText;
                }
                showMessage(`操作失败: ${errorMsg}`, 'error');
            },
            complete: function() {
                buttonElement.prop('disabled', false).text(originalText);
            }
        });
    }

    // =========================================================================
    // 城市数据管理 (加载、渲染、分页)
    // =========================================================================

    // 分页相关变量
    let currentPage = 1;
    let citiesPerPage = 10;
    let allCities = [];
    let editingIndex = -1; // 当前编辑的城市索引，-1表示新建

    function loadCities() {
        $.ajax({
            url: footprintMapAdmin.ajaxUrl,
            type: 'POST',
            data: {
                action: 'footprint_map_get_cities',
                nonce: footprintMapAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    allCities = response.data;
                    currentPage = 1;
                    renderCities();
                }
            }
        });
    }

    function renderCities() {
        const container = $('#cities-container');
        container.empty();
        
        if (allCities.length === 0) {
            container.html('<p class="no-cities">还没有添加城市，请使用上方表单添加您的第一个城市。</p>');
            return;
        }
        
        // 计算分页
        const totalPages = Math.ceil(allCities.length / citiesPerPage);
        const startIndex = (currentPage - 1) * citiesPerPage;
        const endIndex = Math.min(startIndex + citiesPerPage, allCities.length);
        const currentCities = allCities.slice(startIndex, endIndex);
        
        // 渲染城市列表
        currentCities.forEach((city, localIndex) => {
            const globalIndex = startIndex + localIndex;
            const cityElement = $(`
                <div class="city-item" data-index="${globalIndex}">
                    <div class="city-header">
                        <h4 class="city-title">${city.name}</h4>
                        <div class="city-actions">
                            <button type="button" class="button edit-city" title="编辑">编辑</button>
                            <button type="button" class="button delete-city" title="删除">删除</button>
                        </div>
                    </div>
                    <div class="city-details">
                        <div class="detail-item">
                            <span class="label">编码:</span>
                            <span class="value">${city.adcode}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">坐标:</span>
                            <span class="value">${city.center}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">透明度:</span>
                            <span class="value">${city.opacity}/10</span>
                        </div>
                        ${city.tags ? `<div class="detail-item">
                            <span class="label">标签:</span>
                            <span class="value">${city.tags}</span>
                        </div>` : ''}
                        ${(city.date_start && city.date_end) ? `<div class="detail-item">
                            <span class="label">访问日期:</span>
                            <span class="value">${formatCityDate(city)}</span>
                        </div>` : (city.date ? `<div class="detail-item">
                            <span class="label">访问日期:</span>
                            <span class="value">${city.date}</span>
                        </div>` : '')}
                        <div class="detail-item">
                            <span class="label">添加时间:</span>
                            <span class="value">${formatDate(city.created_at)}</span>
                        </div>
                    </div>
                </div>
            `);
            
            cityElement.find('.edit-city').on('click', function() {
                editCity(city, globalIndex);
            });
            
            cityElement.find('.delete-city').on('click', function() {
                if (confirm('确定要删除这个城市吗？')) {
                    performAjaxRequest('delete_city', { index: globalIndex }, $(this), '删除中...', '删除');
                }
            });
            
            container.append(cityElement);
        });
        
        // 渲染分页控件
        if (totalPages > 1) {
            $('.city-pagination').remove(); // 先移除旧的分页控件
            const pagination = $('<div class="city-pagination"></div>');
            
            // 上一页
            if (currentPage > 1) {
                pagination.append(`<button type="button" class="button prev-page">上一页</button>`);
            }
            
            // 页码
            for (let i = 1; i <= totalPages; i++) {
                const pageClass = i === currentPage ? 'current-page' : '';
                pagination.append(`<button type="button" class="button page-number ${pageClass}" data-page="${i}">${i}</button>`);
            }
            
            // 下一页
            if (currentPage < totalPages) {
                pagination.append(`<button type="button" class="button next-page">下一页</button>`);
            }
            
            // 分页信息
            pagination.append(`<span class="page-info">第 ${currentPage} 页，共 ${totalPages} 页 (${allCities.length} 个城市)</span>`);
            
            // 绑定分页事件
            pagination.find('.prev-page').on('click', function() {
                if (currentPage > 1) {
                    currentPage--;
                    renderCities();
                }
            });
            
            pagination.find('.next-page').on('click', function() {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderCities();
                }
            });
            
            pagination.find('.page-number').on('click', function() {
                currentPage = parseInt($(this).data('page'));
                renderCities();
            });
            
            container.after(pagination);
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCityDate(city) {
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
                return `${startFormatted} - ${endFormatted}`;
            } else {
                // 单日显示
                return startDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        } else if (city.date) {
            // 兼容旧数据格式
            const date = new Date(city.date);
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        return '';
    }

    function editCity(city, index) {
        editingIndex = index; // 设置编辑状态
        
        $('#city-name').val(city.name);
        $('#city-adcode').val(city.adcode);
        $('#city-center').val(city.center);
        $('#city-opacity').val(city.opacity);
        $('#city-image').val(city.image || '');
        $('#city-tags').val(city.tags || '');
        $('#opacity-value').text(city.opacity);
        
        // 处理时间段数据
        if (city.date_start && city.date_end) {
            $('#city-date-start').val(city.date_start);
            $('#city-date-end').val(city.date_end);
            if (city.is_date_range && city.date_start !== city.date_end) {
                $('#same-day-checkbox').prop('checked', false).trigger('change');
            } else {
                $('#same-day-checkbox').prop('checked', true).trigger('change');
            }
        } else if (city.date) {
            // 兼容旧数据格式
            $('#city-date-start').val(city.date);
            $('#city-date-end').val(city.date);
            $('#same-day-checkbox').prop('checked', true).trigger('change');
        } else {
            // 没有日期数据，设置为今天
            const today = new Date().toISOString().split('T')[0];
            $('#city-date-start').val(today);
            $('#city-date-end').val(today);
            $('#same-day-checkbox').prop('checked', true).trigger('change');
        }
        
        // 处理自定义描述
        if (city.desc) {
            if (city.desc.indexOf('<div class="city-description">') !== -1) {
                const tempDiv = $('<div>').html(city.desc);
                const descContent = tempDiv.find('.city-description').html();
                if (descContent && descContent.indexOf('在这里记录您对') === -1) {
                    $('#city-desc').val(descContent);
                } else {
                    $('#city-desc').val('');
                }
            } else {
                $('#city-desc').val(city.desc);
            }
        } else {
            $('#city-desc').val('');
        }
        
        // 更新按钮文本
        $('#save-city').text('更新城市');
        
        // 滚动到表单
        $('.city-form')[0].scrollIntoView({ behavior: 'smooth' });
    }

    function clearForm() {
        editingIndex = -1; // 重置编辑状态
        $('#city-name').val('');
        $('#city-adcode').val('');
        $('#city-center').val('');
        $('#city-opacity').val('8');
        $('#city-image').val('');
        $('#city-tags').val('');
        $('#city-desc').val('');
        $('#opacity-value').text('8');
        
        // 重置时间段数据
        const today = new Date().toISOString().split('T')[0];
        $('#city-date-start').val(today);
        $('#city-date-end').val(today);
        $('#same-day-checkbox').prop('checked', true).trigger('change');
        
        $('#save-city').text('保存城市'); // 重置按钮文本
    }

    // =========================================================================
    // 表单处理
    // =========================================================================

    function initFormHandlers() {
        $('#footprint-map-admin-form').on('submit', function(e) {
            e.preventDefault();
            saveCity();
        });

        $('#save-city').on('click', saveCity);

        $('#clear-form').on('click', function(e) {
            e.preventDefault();
            clearForm();
        });
        
        // 透明度滑块
        $('#city-opacity').on('input', function() {
            $('#opacity-value').text($(this).val());
        });

        // 时间段选择逻辑
        initDateRangePicker();
        
        // 坐标拾取器
        $('#open-picker').on('click', function() {
            if (footprintMapAdmin.amapKey) {
                window.open(footprintMapAdmin.pickerUrl, '_blank', 'width=800,height=600');
            } else {
                alert('请先配置高德地图API Key');
            }
        });
        
        // 预览描述
        $('#preview-desc').on('click', function() {
            previewDescription();
        });
        
        // 回车保存（排除textarea，允许回车换行）
        $('.city-form input').on('keypress', function(e) {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                saveCity();
            }
        });

        // 监听坐标拾取器返回的数据
        window.addEventListener('message', function(event) {
            if (event.origin === 'https://lbs.amap.com' && event.data.type === 'coordinate') {
                $('#city-center').val(event.data.coordinate);
            }
        });
    }
    
    function saveCity() {
        const cityData = {
            name: $('#city-name').val().trim(),
            adcode: $('#city-adcode').val().trim(),
            center: $('#city-center').val().trim(),
            opacity: $('#city-opacity').val(),
            desc: generateModernDescription(),
            image: $('#city-image').val().trim(),
            tags: $('#city-tags').val().trim(),
            nonce: footprintMapAdmin.nonce
        };
        
        // 处理时间段数据
        const dateRange = getDateRange();
        if (dateRange) {
            cityData.date_start = dateRange.start;
            cityData.date_end = dateRange.end;
            cityData.is_date_range = dateRange.isRange;
        }

        if (!cityData.name || !cityData.adcode || !cityData.center) {
            alert('请填写城市名称、编码和坐标');
            return;
        }
        
        if (!/^-?\d+\.\d+,-?\d+\.\d+$/.test(cityData.center)) {
            alert('坐标格式不正确，请使用"经度,纬度"格式');
            return;
        }
        
        // 如果是编辑模式，添加编辑索引
        if (editingIndex >= 0) {
            cityData.edit_index = editingIndex;
        }

        const action = editingIndex >= 0 ? 'update_city' : 'save_city';
        const buttonText = editingIndex >= 0 ? '更新中...' : '保存中...';
        const originalText = editingIndex >= 0 ? '更新城市' : '保存城市';

        performAjaxRequest(action, cityData, $('#save-city'), buttonText, originalText);
    }
    
    function generateModernDescription() {
        const name = $('#city-name').val().trim();
        const tags = $('#city-tags').val().trim();
        const image = $('#city-image').val().trim();
        const customDesc = $('#city-desc').val().trim();
        
        let desc = `<div class="city-info">`;
        desc += `<h3 class="city-name">${name}</h3>`;
        
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            desc += `<div class="city-tags">`;
            tagArray.forEach(tag => {
                desc += `<span class="tag">${tag}</span>`;
            });
            desc += `</div>`;
        }
        
        // 处理时间段
        const dateRange = getDateRange();
        if (dateRange) {
            const formattedDate = formatDateRange(dateRange);
            desc += `<div class="visit-date"><i class="dashicons dashicons-calendar"></i> ${formattedDate}</div>`;
        }
        
        desc += `<div class="city-description">`;
        if (customDesc) {
            if (window.marked) {
                desc += marked.parse(customDesc);
            } else {
                desc += customDesc;
            }
        } else {
        desc += `<p>在这里记录您对${name}的美好回忆...</p>`;
        }
        desc += `</div>`;
        
        // 处理多张图片
        if (image && (!customDesc || !customDesc.includes('<img'))) {
            const imageUrls = image.split(',').map(url => url.trim()).filter(url => url);
            if (imageUrls.length > 0) {
                desc += `<div class="city-images" data-count="${imageUrls.length}">`;
                imageUrls.forEach((imageUrl, index) => {
                    desc += `<div class="city-image" data-image-index="${index}" data-image-url="${imageUrl}">`;
                    desc += `<img src="${imageUrl}" alt="${name} - 图片${index + 1}" loading="lazy" data-no-imgbox="true" data-imgbox="false">`;
                    desc += `</div>`;
                });
                desc += `</div>`;
            }
        }
        
        desc += `</div>`;
        
        return desc;
    }
    
    function previewDescription() {
        const name = $('#city-name').val().trim();
        const desc = generateModernDescription();
        const preview = $(`
            <div class="description-preview">
                <h4>预览效果</h4>
                <div class="preview-content">${desc}</div>
                <button type="button" class="button close-preview">关闭预览</button>
            </div>
        `);
        
        $('body').append(preview);
        
        preview.find('.close-preview').on('click', function() {
            preview.remove();
        });
    }
    
    // =========================================================================
    // 城市搜索功能
    // =========================================================================

    function initCitySearch() {
        let searchTimeout;
        let searchResults = [];
        let selectedIndex = -1;
        let isSearching = false;
        let isComposing = false; // 输入法状态标志
        
        // 创建搜索结果容器
        const searchContainer = $('<div id="city-search-results" class="city-search-results"></div>');
        $('#city-name').after(searchContainer);
        
        // 监听城市名称输入
        $('#city-name').on('input compositionend keyup paste', function(e) {
            // 如果是输入法正在输入，跳过处理
            if (isComposing && e.type !== 'compositionend') {
                return;
            }
            
            const searchTerm = $(this).val().trim();
            
            clearTimeout(searchTimeout);
            selectedIndex = -1;
            
            if (searchTerm.length < 1) {
                searchContainer.hide();
                return;
            }
            
            // 防抖处理
            searchTimeout = setTimeout(function() {
                if (!isSearching) {
                    searchCities(searchTerm);
                }
            }, 200);
        });
        
        // 特别处理输入法输入
        $('#city-name').on('compositionstart', function() {
            // 输入法开始输入时，暂停搜索
            isComposing = true;
            clearTimeout(searchTimeout);
        });
        
        $('#city-name').on('compositionend', function() {
            // 输入法输入结束时，立即搜索
            isComposing = false;
            const searchTerm = $(this).val().trim();
            if (searchTerm.length >= 1 && !isSearching) {
                // 输入法输入结束后立即搜索，不使用防抖
                searchCities(searchTerm);
            }
        });
        
        // 监听输入框失去焦点，确保搜索完成
        $('#city-name').on('blur', function() {
            if (isComposing) {
                isComposing = false;
                const searchTerm = $(this).val().trim();
                if (searchTerm.length >= 1 && !isSearching) {
                    searchCities(searchTerm);
                }
            }
        });
        
        // 键盘导航
        $('#city-name').on('keydown', function(e) {
            if (!searchResults.length) return;
            
            switch(e.keyCode) {
                case 38: // 上箭头
                    e.preventDefault();
                    selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : searchResults.length - 1;
                    updateSelection();
                    break;
                case 40: // 下箭头
                    e.preventDefault();
                    selectedIndex = selectedIndex < searchResults.length - 1 ? selectedIndex + 1 : 0;
                    updateSelection();
                    break;
                case 13: // 回车
                    e.preventDefault();
                    if (selectedIndex >= 0 && searchResults[selectedIndex]) {
                        selectCity(searchResults[selectedIndex]);
                    }
                    break;
                case 27: // ESC
                    searchContainer.hide();
                    break;
            }
        });
        
        // 点击外部隐藏搜索结果
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.city-form').length) {
                searchContainer.hide();
            }
        });
        
        function searchCities(searchTerm) {
            if (isSearching) return;
            
            // 验证搜索词
            searchTerm = searchTerm.trim();
            if (!searchTerm || searchTerm.length < 1) {
                searchContainer.hide();
                return;
            }
            
            isSearching = true;
            searchContainer.html('<div style="padding: 10px; text-align: center; color: #666;">搜索中...</div>').show();
            
            $.ajax({
                url: footprintMapAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'footprint_map_search_city',
                    search_term: searchTerm,
                    nonce: footprintMapAdmin.nonce
                },
                timeout: 10000,
                success: function(response) {
                    if (response.success) {
                        searchResults = response.data;
                        displaySearchResults();
                    } else {
                        searchContainer.html('<div style="padding: 10px; text-align: center; color: #666;">搜索失败</div>');
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    searchContainer.html('<div style="padding: 10px; text-align: center; color: #666;">搜索失败，请重试</div>');
                },
                complete: function() {
                    isSearching = false;
                }
            });
        }
        
        function displaySearchResults() {
            if (searchResults.length === 0) {
                searchContainer.hide();
                return;
            }
            
            let html = '';
            searchResults.forEach((city, index) => {
                const isSelected = index === selectedIndex ? 'selected' : '';
                
                html += `<div class="search-result-item ${isSelected} city-level" data-index="${index}">`;
                html += `<div class="city-name">${city.name}`;
                if (city.english) {
                    html += ` <span class="city-english">(${city.english})</span>`;
                }
                html += `</div>`;
                html += `<div class="city-info">${city.level} | ${city.adcode}`;
                if (city.region && city.region !== '中国大陆') {
                    html += ` | ${city.region}`;
                }
                html += `</div>`;
                html += `</div>`;
            });
            
            searchContainer.html(html).show();
            
            // 点击选择
            searchContainer.find('.search-result-item').on('click', function() {
                const index = $(this).data('index');
                selectCity(searchResults[index]);
            });
        }
        
        function updateSelection() {
            searchContainer.find('.search-result-item').removeClass('selected');
            if (selectedIndex >= 0) {
                searchContainer.find(`[data-index="${selectedIndex}"]`).addClass('selected');
            }
        }
        
        function selectCity(city) {
            searchContainer.hide();
            
            // 省级提示
            if (city.level === 'province') {
                showMessage('提示：选择省份不会填充整个省，需要点亮该省每个城市才能填充整个省。', 'info', 6000);
            }
            // 区县提示
            if (city.level === 'district' || city.level === 'county') {
                showMessage('提示：区县不会填充，但会出现在地图上，只有在需要特别强调某个区县时才选择区县。', 'info', 6000);
            }
            
            // 更新表单字段
            $('#city-name').val(city.name);
            $('#city-adcode').val(city.adcode);
            if (city.center) {
                $('#city-center').val(city.center);
            }
            
            // 清空之前的边界
            if (currentBoundary) {
                map.remove(currentBoundary);
                currentBoundary = null;
            }
            
            // 添加新的边界（如果有地图对象）
            if (city.adcode && map) {
                try {
                    const districtLayer = new AMap.DistrictLayer.Province({
                        adcode: city.adcode,
                        depth: 1,
                        styles: {
                            'fill': '#ff0000',
                            'fillOpacity': 0.3,
                            'stroke': '#ff0000',
                            'strokeWidth': 2
                        }
                    });
                    
                    districtLayer.setMap(map);
                    currentBoundary = districtLayer;
                    
                    // 调整地图视野到边界
                    districtLayer.on('complete', function() {
                        const bounds = districtLayer.getBounds();
                        if (bounds) {
                            map.setBounds(bounds);
                        }
                    });
                } catch (error) {
                    console.error('地图边界显示失败:', error);
                }
            }
        }
    }

    // =========================================================================
    // 数据导入/导出
    // =========================================================================

    function initImportExport() {
        $('#export-json').on('click', exportJson);
        
        // 导入按钮点击事件
        $('#import-json').on('click', function() {
            $('#import-options').slideDown(300);
        });
        
        // 导入标签切换
        $('.import-tab').on('click', function() {
            const tab = $(this).data('tab');
            
            // 更新标签状态
            $('.import-tab').removeClass('active');
            $(this).addClass('active');
            
            // 更新面板显示
            $('.import-panel').removeClass('active');
            if (tab === 'json') {
                $('#import-json-input').addClass('active');
            } else {
                $(`#import-${tab}`).addClass('active');
            }
        });
        
        // 取消导入
        $('#cancel-import, #cancel-import-json').on('click', function() {
            $('#import-options').slideUp(300);
            resetImportForm();
        });
        
        // 文件上传导入
        $('#import-file-btn').on('click', function() {
            const fileInput = $('#import-json-file')[0];
            if (!fileInput.files || fileInput.files.length === 0) {
                showMessage('请选择要导入的JSON文件', 'error');
                return;
            }
            
            const file = fileInput.files[0];
            
            // 检查文件大小（2MB限制）
            if (file.size > 2 * 1024 * 1024) {
                showMessage('文件大小不能超过2MB', 'error');
                return;
            }
            
            // 检查文件类型
            if (!file.name.toLowerCase().endsWith('.json')) {
                showMessage('请选择JSON格式的文件', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const json = evt.target.result;
                    // 验证JSON格式
                    JSON.parse(json);
                    importJson(json);
                } catch (err) {
                    showMessage('文件格式错误，请确保是有效的JSON文件', 'error');
                }
            };
            reader.onerror = function() {
                showMessage('文件读取失败', 'error');
            };
            reader.readAsText(file);
        });
        
        // JSON输入导入
        $('#import-json-btn').on('click', function() {
            const jsonInput = $('#json-input').val().trim();
            if (!jsonInput) {
                showMessage('请输入JSON数据', 'error');
            return;
        }
        
            try {
                // 验证JSON格式
                JSON.parse(jsonInput);
                importJson(jsonInput);
            } catch (err) {
                showMessage('JSON格式错误，请检查输入的数据', 'error');
            }
        });
        
        // 文件选择变化时显示文件名
        $('#import-json-file').on('change', function() {
            const file = this.files[0];
            if (file) {
                const status = $(`<div class="file-upload-status info">已选择文件: ${file.name} (${(file.size / 1024).toFixed(1)}KB)</div>`);
                $('#import-file .form-group').append(status);
                
                // 3秒后自动移除状态信息
                setTimeout(() => {
                    status.fadeOut(300, function() {
                        $(this).remove();
                    });
                }, 3000);
            }
        });
        
        // 查看JSON示例
        $('#show-json-example').on('click', function() {
            const example = `[
  {
    "name": "北京",
    "adcode": "110000",
    "center": "116.407526,39.904030",
    "opacity": 8,
    "desc": "<div class=\\"city-info\\"><h3 class=\\"city-name\\">北京</h3><div class=\\"city-tags\\"><span class=\\"tag\\">首都</span><span class=\\"tag\\">政治</span><span class=\\"tag\\">文化</span></div><div class=\\"visit-date\\"><i class=\\"dashicons dashicons-calendar\\"></i> 2023年1月1日</div><div class=\\"city-description\\"><p>首都，政治文化中心，有着悠久的历史文化。</p></div></div>",
    "image": "https://example.com/beijing.jpg",
    "tags": "首都,政治,文化",
    "date_start": "2023-01-01",
    "date_end": "2023-01-01",
    "is_date_range": false,
    "created_at": "2023-01-01 10:00:00"
  },
  {
    "name": "上海",
    "adcode": "310000",
    "center": "121.473701,31.230416",
    "opacity": 7,
    "desc": "<div class=\\"city-info\\"><h3 class=\\"city-name\\">上海</h3><div class=\\"city-tags\\"><span class=\\"tag\\">经济</span><span class=\\"tag\\">金融</span><span class=\\"tag\\">国际化</span></div><div class=\\"visit-date\\"><i class=\\"dashicons dashicons-calendar\\"></i> 2023年2月15日 - 2023年2月20日</div><div class=\\"city-description\\"><p>国际化大都市，经济金融中心。</p></div></div>",
    "image": "https://example.com/shanghai.jpg",
    "tags": "经济,金融,国际化",
    "date_start": "2023-02-15",
    "date_end": "2023-02-20",
    "is_date_range": true,
    "created_at": "2023-02-15 14:30:00"
  }
]`;
            
            const preview = $(`
                <div class="description-preview">
                    <h4>JSON数据格式示例</h4>
                    <div class="preview-content">
                        <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; line-height: 1.4;">${JSON.stringify(JSON.parse(example), null, 2)}</pre>
                        <div style="margin-top: 15px;">
                            <h5>字段说明：</h5>
                            <ul style="font-size: 13px; line-height: 1.6;">
                                <li><strong>name</strong>: 城市名称（必填）</li>
                                <li><strong>adcode</strong>: 城市编码（必填）</li>
                                <li><strong>center</strong>: 坐标，格式为"经度,纬度"（必填）</li>
                                <li><strong>opacity</strong>: 透明度，1-10（可选，默认8）</li>
                                <li><strong>desc</strong>: 描述内容，支持HTML（可选）</li>
                                <li><strong>image</strong>: 图片URL（可选）</li>
                                <li><strong>tags</strong>: 标签，用逗号分隔（可选）</li>
                                <li><strong>date_start</strong>: 开始日期，YYYY-MM-DD格式（可选）</li>
                                <li><strong>date_end</strong>: 结束日期，YYYY-MM-DD格式（可选）</li>
                                <li><strong>is_date_range</strong>: 是否为时间段，true/false（可选）</li>
                                <li><strong>created_at</strong>: 创建时间（可选，导入时自动生成）</li>
                            </ul>
                        </div>
                    </div>
                    <button type="button" class="button close-preview">关闭</button>
                </div>
            `);
            
            $('body').append(preview);
            
            preview.find('.close-preview').on('click', function() {
                preview.remove();
            });
        });
    }
    
    function resetImportForm() {
        $('#import-json-file').val('');
        $('#json-input').val('');
        $('.file-upload-status').remove();
        $('.import-tab').removeClass('active');
        $('.import-tab[data-tab="file"]').addClass('active');
        $('.import-panel').removeClass('active');
        $('#import-file').addClass('active');
    }
    
    function importJson(json) {
        // 显示确认对话框
        if (!confirm('导入数据将覆盖当前所有城市数据，确定要继续吗？')) {
            return;
        }
        
        performAjaxRequest('import_json', { json: json }, $('#import-json'), '导入中...', '导入JSON');
        
        // 导入成功后隐藏导入选项
        setTimeout(() => {
            $('#import-options').slideUp(300);
            resetImportForm();
        }, 1000);
    }

    function exportJson() {
        const button = $('#export-json');
        button.prop('disabled', true).text('导出中...');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', footprintMapAdmin.ajaxUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.responseType = 'blob';

        xhr.onload = function() {
            if (this.status === 200) {
                const blob = this.response;
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        // 检查返回的是否为JSON错误信息
                        const jsonResponse = JSON.parse(reader.result);
                        if (jsonResponse && jsonResponse.success === false) {
                            showMessage(jsonResponse.data.message || '导出失败', 'error');
                        } else if (jsonResponse && jsonResponse.success === true) {
                            // 成功响应，但可能是错误信息
                            showMessage(jsonResponse.data.message || '导出失败', 'error');
                        } else {
                            // 如果不是标准JSON响应，尝试作为文件下载
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'footprint-map-cities-' + new Date().toISOString().slice(0,10) + '.json';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                            showMessage('导出成功', 'success');
                        }
                    } catch (e) {
                        // 如果解析JSON失败，说明是文件流，正常下载
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'footprint-map-cities-' + new Date().toISOString().slice(0,10) + '.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                        showMessage('导出成功', 'success');
                    }
                };
                reader.readAsText(xhr.response);
            } else if (this.status === 400) {
                // 处理400错误（没有数据可导出）
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const jsonResponse = JSON.parse(reader.result);
                        showMessage(jsonResponse.data.message || '没有数据可导出', 'error');
                    } catch (e) {
                        showMessage('没有数据可导出', 'error');
                    }
                };
                reader.readAsText(xhr.response);
                } else {
                showMessage('导出失败: 服务器错误 (状态码: ' + this.status + ')', 'error');
                }
            button.prop('disabled', false).text('导出JSON');
        };

        xhr.onerror = function() {
            showMessage('导出失败: 网络错误', 'error');
            button.prop('disabled', false).text('导出JSON');
        };

        xhr.send(`action=footprint_map_export_json&nonce=${footprintMapAdmin.nonce}`);
    }

    // =========================================================================
    // WebDAV 备份/恢复
    // =========================================================================

    function initBackupManager() {
        $('#backup-now').on('click', backupToWebdav);
        $('#restore-data').on('click', function() {
            if (confirm('恢复数据将覆盖当前所有城市数据，确定要继续吗？')) {
                restoreFromWebdav();
            }
        });
    }
    
    function backupToWebdav() {
        performAjaxRequest('backup_webdav', {}, $('#backup-now'), '备份中...', '立即备份');
    }

    function restoreFromWebdav() {
        performAjaxRequest('restore_webdav', {}, $('#restore-data'), '恢复中...', '恢复数据');
    }

    // =========================================================================
    // 时间段选择
    // =========================================================================

    function initDateRangePicker() {
        const startDateInput = $('#city-date-start');
        const endDateInput = $('#city-date-end');
        const sameDayCheckbox = $('#same-day-checkbox');
        const endDateGroup = $('.date-input-group').eq(1); // 结束日期组

        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        startDateInput.val(today);
        endDateInput.val(today);

        // 同一天复选框变化事件
        sameDayCheckbox.on('change', function() {
            if (this.checked) {
                // 同一天模式
                endDateGroup.addClass('disabled');
                endDateInput.prop('disabled', true);
                endDateInput.val(startDateInput.val());
                } else {
                // 时间段模式
                endDateGroup.removeClass('disabled');
                endDateInput.prop('disabled', false);
                // 如果结束日期早于开始日期，设置为开始日期
                if (endDateInput.val() && endDateInput.val() < startDateInput.val()) {
                    endDateInput.val(startDateInput.val());
                }
            }
        });

        // 开始日期变化事件
        startDateInput.on('change', function() {
            if (sameDayCheckbox.is(':checked')) {
                // 同一天模式下，结束日期跟随开始日期
                endDateInput.val($(this).val());
                } else {
                // 时间段模式下，检查结束日期是否早于开始日期
                if (endDateInput.val() && endDateInput.val() < $(this).val()) {
                    endDateInput.val($(this).val());
                }
            }
        });

        // 结束日期变化事件
        endDateInput.on('change', function() {
            if ($(this).val() && $(this).val() < startDateInput.val()) {
                showMessage('结束日期不能早于开始日期', 'error');
                $(this).val(startDateInput.val());
            }
        });

        // 初始化状态
        sameDayCheckbox.trigger('change');
    }
    
    function getDateRange() {
        const startDate = $('#city-date-start').val();
        const endDate = $('#city-date-end').val();
        const isSameDay = $('#same-day-checkbox').is(':checked');

        if (!startDate) {
            return null;
    }
    
        if (isSameDay || startDate === endDate) {
            return {
                start: startDate,
                end: startDate,
                isRange: false
            };
        } else {
            return {
                start: startDate,
                end: endDate,
                isRange: true
            };
        }
    }

    function formatDateRange(dateRange) {
        if (!dateRange) return '';

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        if (!dateRange.isRange || dateRange.start === dateRange.end) {
            // 单日显示
            return startDate.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else {
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
            return `${startFormatted} - ${endFormatted}`;
        }
    }
    
    // =========================================================================
    // 初始化
    // =========================================================================

    // 在页面加载时动态引入marked.js
    (function() {
        if (!window.marked) {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            script.onload = function() {
                window.markedLoaded = true;
            };
            document.head.appendChild(script);
        }
    })();
    
    // 页面加载完成后执行所有初始化
    initSidebarNavigation();
    initFormHandlers();
    initCitySearch();
    initImportExport();
    initBackupManager();
    initDateRangePicker();
    loadCities();

}); 