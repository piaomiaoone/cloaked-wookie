/*
 * Copyright 2014 Baidu Inc. All rights reserved.
 *
 * author:  mycoin (nqliujiangtao@gmail.com)
 * date:    2013/09/28
 * resp:    https://github.com/mycoin/SDK/
 */
define(function(require, exports) {
    'use strict';

    // 光荣的使用zepto库
    var zepto = require('./zepto');

    /**
     * Simple common assertion API
     * @public
     *
     * @param {*} condition The condition to test.  Note that this may be used to
     *     test whether a value is defined or not, and we don't want to force a
     *     cast to Boolean.
     * @param {string=} opt_message A message to use in any error.
     */
    function assert(condition, opt_message) {
        if (!condition) {
            var msg = 'Assertion failed';
            if (opt_message) {
                msg = msg + ': ' + opt_message;
            }
            throw new Error(msg);
        }
    }

    /**
     * Copy properties from the source object to the target object
     *
     * @public
     * @param {Object} target the target object
     * @param {Object} source the source object
     * @param {Boolean} overwrite if overwrite the same property, default 'true'
     * @return target
     */
    function extend(target, source, overwrite) {
        if (undefined === overwrite) {
            overwrite = true;
        }
        for (var key in source || {}) {
            if (source.hasOwnProperty(key) && (overwrite || !target.hasOwnProperty(key))) {
                target[key] = source[key];
            }
        }
        return target;
    }

    /**
     * returns a non-standard random IDs of arbitrary length and radix.
     * @return {string} the result
     * @see http://www.broofa.com/2008/09/javascript-uuid-function/
     */
    function getGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
            function(iterator) {
                var random = Math.random() * 16 | 0;
                random = iterator == 'x' ? random : (random & 0x3 | 0x8);
                return random.toString(16);
            });
    }

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    function isArray(obj) {
        return {}.toString.call(obj) == '[object Array]';
    }

    // Is a given variable an object?
    function isObject(obj) {
        return obj === Object(obj);
    }

    /**
     * 元类创建方法
     * @return {Function}
     */
    function Class(property) {
        var Base = function() {
            // 用静态方法去验证参数传递是否合法
            if (typeof Base.auth == 'function') {
                Base.auth.apply(this, arguments);
            }

            // 创建事件缓存对象
            this.attribute('event', {});
        }

        // 缓存对象，用于在闭包里面存储私有属性
        var cache = {};

        // 添加自定义事件，基于事件驱动
        extend(Base.prototype, {

            // 设置属性
            attribute: function(k, value) {
                if (arguments.length == 1) {
                    return cache[k];
                } else {
                    cache[k] = value;
                }
            },

            /**
             * 订阅一个事件
             *
             * @param {string} type 消息名称
             * @param {function} callback 回调函数
             */
            bind: function(message, listenner, context) {
                var eve = this.attribute('event');
                if (!eve[message]) {
                    eve[message] = [];
                }
                eve.token = (eve.token || 0) + 1;
                eve[message].push({
                    id: eve.token,
                    listenner: listenner,
                    context: context || this
                });

                return eve.token;
            },

            /**
             * 通知事件，所有订阅该消息的任务都回被执行
             *
             * @param {string} type 消息名称
             * @param {array} argv 参数队列
             */
            notify: function(message, argv) {
                var eve = this.attribute('event');
                var item;
                if (eve[message]) {
                    for (var i = 0; i < eve[message].length; i++) {
                        item = eve[message][i] || {};
                        if (item.listenner) {
                            // @todo防止干扰其他的分发
                            item.listenner.apply(item.context, argv);
                        }
                    }
                }
            },

            /**
             * 取消侦听事件
             *
             * @public
             * @param {string} message 事件类型
             * @param {function} listenner 事件处理函数
             * @e.g:
             *      unbind();
             *      unbind(token);
             *      unbind('message');
             *      unbind(Function);
             *      unbind('message', Function);
             *
             * @return this
             */
            unbind: function(message, listenner) {
                var eve = this.attribute('event'),
                    event;
                if (arguments.length) {
                    // 用token来反注册事件
                    for (var k in eve) {
                        event = eve[k] || [];
                        if (arguments.length == 1 && message == k) {
                            // 解绑某一个类型的事件，不需要在循环
                            delete eve[k];
                            break;
                        } else {
                            // 已经注册的事件
                            for (var i = 0, length = event.length; i < length; i += 1) {
                                if (!isObject(event[i])) {
                                    break;
                                }
                                if (event[i].id == message || message == event[i].listenner || (k == message && listenner == event[i].listenner)) {
                                    event.splice(i, 1);
                                }
                            }
                        }
                    }
                } else {
                    // 解绑所有的事件
                    this.attribute('event', {});
                }
                return this;
            },

            /**
             * 销毁函数
             *
             * @public
             * @param {string} type 事件类型
             * @param {array|function|undefined}
             * @param {function} success the callback function
             */
            destroy: function() {}
        });

        /**
         * 给类的原型链扩展字段或者方法
         *
         * @public
         * @param {string} type 事件类型
         * @param {array|function|undefined}
         * @param {function} success the callback function
         */
        Base.extend = function(object) {
            for (var k in object) {
                if (k == 'attribute' || k == 'bind' || k == 'unbind') {
                    throw 'cannot overwrite `attribute/bind/unbind` function.';
                }
                Base.prototype[k] = object[k];
            }
            return this;
        }

        if (isObject(property)) {
            Base.extend(property);
        }
        return Base;
    }

    // 视图模块，视图注意提供模板引擎，批量绑定事件，notice事件
    var View = new Class({
        /**
         * 视图初始化函数
         *
         * @function
         * @param {object} opt 用户配置项，包含基本事件绑定任务等
         * @param {string} opt.template 模板代码，一般 require 进来的HTML
         * @param {object} opt.event 快捷的事件绑定
         * @param {string} opt.main 当前场景的ID，用于绑定事件代理
         */
        init: function(opt) {
            var me = this;

            // 提前注册好，防止使用的未ready前调用时报错
            me.attribute('nativeEvent', []);

            // 初始化视图引擎
            me.setTemplate(String(opt.template) || '');

            // 转移init函数到用户自定义函数，同时传递上下文为me
            me.init = function() {
                if (typeof opt.init == 'function') {
                    // 注意这里的参数是控制器传递来的
                    opt.init.apply(me, arguments);
                }

                // 防止重复绑定
                me.init = function() {};
                return me;
            };

            var ready = function() {
                // 绑定配置的事件
                // debugger
                var handle = View.bindEvent(opt.event, me, opt.main);

                // 不知道还有没有在DOM ready之后干得事儿
                if (typeof opt.ready == 'function') {
                    opt.ready.call(me);
                }

                // 设置解绑事件的执行函数
                me.attribute('nativeEvent', handle);

                setTimeout(function() {
                    // 取消当前操作
                    me.unbind('ready', ready);
                }, 0);
            };

            // 若被通知View已经准备OK，才能绑定事件
            this.bind('ready', ready);

            return this;
        },

        /**
         * 设置模板片段
         *
         * @function
         * @param {string} target etpl代码片段名称
         * @return this
         */
        setTemplate: function(template) {
            if (typeof template == 'string') {
                this.template = View.initTemplate(template);
            } else {
                throw ('setTemplate() only accept a html string.');
            }
            return this;
        },

        /**
         * 调用模板引擎渲染DOM节点
         *
         * @function
         * @param {string} target etpl代码片段名称
         * @param {object} data 渲染使用的数据JSON，一般从Model传过来
         * @param {string|element} element DOM节点或者CSS3选择器
         *
         * @return this
         */
        render: function(target, data, element) {
            // @todo 这里应该还需要对绑定在 DOM 上的事件销毁

            var html = this.template.render(target, data);
            if (arguments.length > 2) {
                zepto(element).html(html);
            }
            return html;
        },

        /**
         * 销毁函数
         *
         * @public
         */
        destroy: function() {
            var handle = this.attribute('nativeEvent');
            View.unbindEvent(handle);

            // 解绑所有事件，等待销毁
            this.unbind();
        }
    });

    /**
     *  模板引擎，这里光荣的使用ETPL
     *
     * @object
     * @return Object
     */
    View.Template = require('./etpl');

    /**
     * 创建etpl实例，用于渲染视图
     *
     * @static
     * @param {string} template 模板HTML片段
     * @param {object=} context 事件回调函数上下文
     * @return 模板引擎实例
     */
    View.initTemplate = function(tpl, context) {
        // 创建etpl实例
        var template = new this.Template.Engine({
            commandOpen: '<%',
            commandClose: '%>',
            defaultFilter: 'html'
        });

        // 复制修改器，因为每次新建实例会丢失部分属性
        template.filters = this.Template.filters;

        // 编译模板片段
        template.compile(tpl);

        if (context && !context.template) {
            context.template = template;
        }

        // 返回实例，主要是供View实例使用
        return template;
    };

    /**
     * 静态方法，用来绑定View事件
     *
     * @static
     * @param {object} eventMap 事件配置项
     * @param {object} context 事件回调函数上下文
     * @param {element=} root 跟节点DOM
     * @return {array} 解绑函数数组
     */
    View.bindEvent = function(eventMap, context, root) {
        root = zepto(root || document.body);

        // 已注册事件列表
        var eventList = [];

        // 事件绑定的语法 ':[tap] #userName .input[name=login]': function(){}
        var regx = /^\s*(@|!)?\s*\[([a-z,\s]*)\]\s*([\w\W]*)/;

        // 无疑需要闭包，创建事件回调函数
        var createEvent = function(callback, flag) {
            var allow = true;

            var once = (flag == '!');
            return function(event) {
                var returnValue = true;
                if (allow) {
                    returnValue = callback.call(context, event, zepto(this));
                }
                // 如果once返回falsely，表示还需要监听下一次
                if (once && returnValue !== false) {
                    allow = false;
                }
                return returnValue;
            };
        };

        // 注册事件并返回解绑函数
        var dispatchEvent = function(flag, selector, type, func) {
            if (flag == '@') {
                root.delegate(selector, type, func);
                return function() {
                    root.undelegate(selector, type, func);
                };
            } else {
                var el = zepto(selector); // DOM节点
                el.bind(type, func);
                return function() {
                    el.unbind(type, func);
                };
            }
        };

        // 批量绑定Event
        for (var name in eventMap || {}) {
            var exec = regx.exec(name);
            if (exec && exec.length > 2) {

                var selector = exec[3]; // CSS3筛选器
                var type = exec[2]; // 事件类型
                var func = createEvent(eventMap[name], exec[1]);

                eventList.push({
                    key: name,
                    callback: dispatchEvent(exec[1], selector, type, func)
                });
            }
        }
        return eventList;
    };

    /**
     * 静态方法用于删除事件
     *
     * @static
     * @param {array} eventList 事件列表
     * @return null
     */
    View.unbindEvent = function(eventList) {
        var config = null;
        if (isArray(eventList) && eventList.length) {
            while (config = eventList.pop()) { // jshint ignore:line
                if (config && typeof config.callback == 'function') {

                    // 绑定事件的时候返回的是解绑函数
                    config.callback();
                }
            }
        }
    };

    /**
     * 创建View对象，并复制自定义的属性
     *
     * @static
     * @param {object} opt 用户定义的配置项
     * @return {object}
     */
    View.create = function(opt) {
        var view = new View(opt);

        view.init(opt);

        // 将用户定义在View上的属性同步到实例
        for (var k in opt) {
            if (typeof view[k] == 'undefined') {
                view[k] = opt[k];
            }
        }

        return view;
    };

    // 模型提供基本的数据读取写入，支持.解析，同时封装了异步请求
    var Model = new Class({
        /**
         * 初始化Model实例
         *
         * @public
         * @param {object} opt 基本配置项
         * @param {object=} opt.param 异步请求的参数
         * @param {object=} opt.config 业务需要使用到的常量等等
         * @param {object} opt.data 页面默认缓存数据
         
         * @param {function} success the callback function
         */
        init: function(opt) {
            var me = this;

            // 开辟用于Model缓存数据的私有对象
            this.data = {};

            // 开辟一片用于异步请求参数管理的区块
            this.attribute('param', {});

            // 配置基本的属性
            this.config(opt.config);

            // 注入默认的数据到Model里面
            me.setData(opt.data);

            // 设置默认异步请求参数 
            me.param(opt.param);

            // 挂载用户自定义函数
            me.init = function() {

                if (typeof opt.init == 'function') {
                    opt.init.apply(me, arguments);
                }

                // 执行完init应该销毁防止多次init导致事件重复
                me.init = function() {};
                return me;
            };

            // 自动销毁，防止复制到Model实例而干扰环境
            delete opt.data;
            delete opt.param;
        },

        // 配置基本的属性，例如异步请求的地址等等
        config: function(key) {
            if (isObject(key)) {
                extend(this.config, key, true);
            } else {
                return this.config[key];
            }
        },

        /**
         * set方法，用于注入JSON到指定的节点，如果第一个参数为object，支持全量替换
         *
         * @public
         * @param {string} name 名称
         * @param {object=} value 灌入的Value
         *
         * @e.g: model.setData('userInfo.tasks', [1, 2, 3]);
         * @e.g: model.setData({userInfo: {name: 'nqliujiangtao@gmail.com'}});
         * @e.g: model.setData({userInfo: {}}, true);
         *
         * @return
         */
        setData: function(name, value) {
            var data = this.data;

            // 支持多种参数
            if (typeof name == 'string') {
                //@todo kill same first top name.
                var packages = name.split('.'),
                    owner = data,
                    key, result;

                while (key = packages.shift()) { // jshint ignore:line
                    if (packages.length > 0) {

                        // 如果`owner`不是object将不能正常附加属性
                        owner = owner[key] = owner[key] || {};
                        continue;
                    }
                    owner[key] = value;
                }
            } else if (isObject(name)) {
                if (value) {
                    // 彻底替换
                    this.attribute('data', name);
                } else {
                    // 增量填充
                    extend(data, name, true);
                }
            }
            return this;
        },

        /**
         * 获取数据，如果不存在返回 undefined
         *
         * @public
         * @param {string} name 需要获取的字段名称，支持多级
         * @param {object} defaultValue 如果不存在get的值，将返回此Value
         *
         * @e.g: model.getData('userInfo.tasks');
         * @e.g: model.getData('userInfo.unavailable', ['default']);
         *
         * @return
         */
        getData: function(name, defaultValue) {
            var data = this.data;
            var key, packages = (name || '').split('.'),
                owner = data;

            if (!packages.length) {
                return data;
            }
            while (key = packages.shift()) { // jshint ignore:line
                //if given the callback, needn't return.
                if (typeof owner[key] == 'undefined') {
                    return defaultValue;
                }
                owner = owner[key];
            }
            return owner;
        },

        /**
         * 异步请求的参数设置，get/set一身
         *
         * @public
         * @param {string} key 字段名称，如果为object类型将执行合并
         * @param {object=} value 设置Value
         * @return
         */
        param: function(key, value) {
            var result = this.attribute('param');
            switch (arguments.length) {
                case 0:
                    break;
                case 1:
                    if (isObject(key)) {
                        extend(result, key, true);
                    } else {
                        result = result[key];
                    }
                    break;
                case 2:
                    result[key] = value;
                    break;
            }
            return result;
        },

        /**
         * 发送异步请求
         *
         * @public
         * @param {object} extendParam 额外的参数，如果没有传入null即可
         * @param {function=} callback 异步请求完成的回调函数，先触发 onrequest 事件
         * @return
         */
        request: function(key, extendParam, success, failed) {
            var param = {};
            var me = this;

            if (extendParam && typeof extendParam == 'object') {
                param = extendParam;
            } else {
                param = this.param();
            }

            key = this.config('' + key) || key;

            // 断言地址是否合法
            assert(key && typeof key == 'string');

            // 发起异步请求
            Model.ajax(key, param, function(result, request, XHR) {

                // 通知函数，可能大部分使用request发起的请求对不用回调函数，直接绑定request即可
                me.notify('request', [result, request, XHR], me);

                // 回调函数
                if (typeof success == 'function') {
                    success.call(me, result, request, XHR);
                }
            }, function(status, statusText, xhr) {
                // 发布异步请求失败的消息
                me.notify('error', arguments);

                // 回调失败函数
                if (typeof failed == 'function') {
                    failed.call(me, result, request, XHR);
                }
            });

            return this;
        },
        /**
         * 销毁函数
         *
         * @public
         */
        destroy: function() {
            this.unbind();
        }
    });

    /**
     * 创建View对象，并复制自定义的属性
     *
     * @static
     * @param {object} opt 用户定义的配置项
     * @return {object}
     */
    Model.create = function(opt) {
        var model = new Model(opt);

        model.init(opt);

        // 将用户定义在Model上的属性同步到实例
        for (var k in opt) {
            if (typeof model[k] == 'undefined') {
                model[k] = opt[k];
            }
        }
        return model;
    };

    /**
     * 异步请求统一处理函数
     *
     * @param {string} path 异步请求地址
     * @param {object} data 异步请求参数，必须是JSON格式
     * @param {function} success 异步请求成功回调函数
     * @return {meta.Promise} 对应的`Promise`对象，数据加载完成后触发
     * @ignore
     */
    Model.ajax = function(path, data, success, failed) {
        var token = getGuid();

        var headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Requested-Auth-Token': token
        };

        var request = {};
        for (var k in data) {
            if ('string' == typeof data[k] || 'number' == typeof data[k]) {
                request[k] = data[k];
            } else {}
        }

        var settings = {
            type: 'GET',
            data: request,
            url: path,
            dataType: 'json',
            error: function(XHR, textStatus, errorThrown) {
                if (typeof failed == 'function') {
                    failed(XHR.status, XHR.statusText, XHR);
                } else {
                    throw errorThrown;
                }
            },
            success: function(result, textStatus, XHR) {
                success(result, request, XHR);
            },
            headers: headers
        };

        return zepto.ajax(settings);
    };

    var Action = new Class({
        init: function(opt) {
            var me = this;

            // 挂载View，Model给控制器
            me.view = opt.view;
            me.model = opt.model;

            // 监听View，Model的各种事件，方便View通知控制器并将数据转发给控制器托管
            Action.listenEmits(opt.event, me);

            // 挂载用户自定义函数
            me.init = function() {

                // 初始化Model实例
                me.model.init(me.datasource);

                // 唤醒View实例
                me.view.init(me.config);

                if (typeof opt.init == 'function') {
                    opt.init.apply(me, arguments);
                }

                // 执行完init应该销毁防止多次init导致事件重复
                me.init = function() {};
                return me;
            };

            delete opt.event;
        },

        destroy: function() {

            // 首先定制的事件全部取消
            this.unbind();

            // 分别调用其销毁方法
            this.view.destroy();
            this.model.destroy();
        }
    });


    /**
     * 创建View对象，并复制自定义的属性
     *
     * @static
     * @param {object} opt 用户定义的配置项
     * @return {object}
     */
    Action.create = function(opt) {
        var action = new Action(opt);

        action.init(opt);

        // 将用户定义在action上的属性同步到实例
        for (var k in opt) {
            if (typeof action[k] == 'undefined') {
                action[k] = opt[k];
            }
        }
        return action;
    };

    /**
     * 关联事件，使用View抛出来的通知可以被Controller收到
     *
     * @public
     * @param {View} view 与当前控制器绑定的View实例
     * @param {Model} model 数据操作对象
     * @param {Controller} controller 控制器实例
     */
    Action.listenEmits = function(eventMap, controller) {
        var regx = /(\S*)\s*:\s*(\S*)/;
        var type, context;

        // 无疑需要闭包
        var createEvent = function(callback) {
            var allow = true;
            return function() {
                callback.apply(controller, arguments);
            };
        };

        for (var name in eventMap) {
            var result = regx.exec(name);
            if (result && result[2]) {
                type = result[2];
                context = controller[result[1]];
                context.bind(type, createEvent(eventMap[name]));
            }
        }
    };

    return {
        View: View,
        Model: Model,
        Action: Action,
        Class: Class
    };
});