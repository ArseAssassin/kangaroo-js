/* Author: 
	Tuomas Kanerva
*/

define(function (){
	var services; // used to inject external services into the scope

	function getServices()
	{
		if (!services)
			throw new Error("Services unavailable");
		return services;
	}
	
	function DataError(msg)
	{
		this.message = msg
	}
	DataError.prototype = Error.prototype

	var kangaroo = (function() {
		var FileNotFound = function(message, url)
		{
			this.message = message
			this.url = url
		}
		FileNotFound.prototype = Error.prototype
		
		var PageMap = function(data)
		{
			this.data = data

			this.getPage = function(path)
			{
				for (var i in this.data)
				{
					var re = new RegExp("^" + i + "$")
					if (re.test(path))
					{
						var matches = re.exec(path)
						return new Page(this.data[i], matches);
					}	
				}

				throw new FileNotFound("Invalid page name " + name, path)
			}
		}

		var Page = function(data, matches)
		{
			this.data = data
			this.matches = matches

			this.init = function()
			{
				this.modules = []

				for (var name in this.data)
				{
					this.modules.push(new ModuleContent(this.data[name], name, matches))
				}
			}

			this.init()

			this.getModules = function()
			{
				return this.modules;
			}
		}

		var ModuleContent = function(data, name, matches)
		{
			this.data = data
			this.name = name
			this.matches = matches

			this.getTemplateOrNull = function()
			{
				if (!this.data.template)
					return null
				return this.templatePath(this.data.template)
			}

			this.templatePath = function(path)
			{
				var s = path

				for (var i= 0; i < this.matches.length; i++)
				{
					s = s.replace("$" + i, this.matches[i])
				}

				return s;
			}

			this.getDirectivesOrNull = function()
			{
				if (!this.data.directives)
					return null
				return this.data.directives;
			}

			this.getDataOrNull = function()
			{
				if (!this.data.data)
					return null
				else
					return this.templatePath(this.data.data);
			}

			this.getName = function()
			{
				return this.name
			}
		}

		var Core = function()
		{
			this.history = []
			this.blocks = []
			this.pageMap = new PageMap({})

			this.init = function()
			{
				var self = this;

				$(window).hashchange(function() {
					var url = getServices().getCurrentURLHash();
					self.addPageAndRender(url);
				})

				$("*[data-elementtype='module']").each(function() {
					var a = new Module(this)
					self.addBlock(a)
				})

				this.loadPageMap(function(pageMap) {
					pageMap = new PageMap(pageMap)
					self.pageMap = pageMap

					var url = getServices().getCurrentURLHash()

					self.addPageAndRender(url ? url : "/")
					self.initDefaultModules()
				})
			}

			this.initDefaultModules = function()
			{
				for (var i in this.blocks)
				{
					var module = this.blocks[i]

					// if (!module.object.isActive())
					// 	module.object.initDefault()
				}
			}

			this.loadPageMap = function(callback)
			{
				var self = this
				getServices().loadPageMap(callback)
			}

			this.addBlock = function(object)
			{
				this.blocks.push(
					{
						object: object,
						initial: $(this).attr("data-initial-data"),
						template: $(this).attr("data-initial-template")
					}
				)	
			}

			this.getBlock = function(name)
			{
				for (var i in this.blocks)
				{
					var block = this.blocks[i];

					if (block.object.nameIs(name))
						return block.object;
				}

				throw new Error("Invalid name " + name)
			}

			this.addPageAndRender = function(name)
			{
				if (name != "/" && name != "")
					document.location.href = "#" + name
				this.addPage(name)

				this.renderCurrent()
			}

			this.addPage = function(name)
			{
				try {
					var page = this.pageMap.getPage(name)

					this.history.push(page)
				} catch(e)
				{
					if (e.url)
						getServices().handle404(e, this)
					else
						throw e;
				}
			}

			this.getCurrentPage = function()
			{
				if (!this.history.length)
					return this.pageMap.getPage("/404")
				else
					return this.history[this.history.length-1]
			}

			this.renderCurrent = function()
			{
				var page = this.getCurrentPage()
				
				this.renderPage(page)
			}
			
			this.renderPage = function(page, contextFactory)
			{
				if (!contextFactory)
					function contextFactory(data, template, directives)
					{
						return new Context(data, template, directives);
					}
					
				var modules = page.getModules()

				for (var i in modules)
				{
					var module = modules[i]

					block = this.getBlock(module.getName())

					var data = module.getDataOrNull();
					var template = module.getTemplateOrNull();
					var directives = module.getDirectivesOrNull();
					if (!data)
						data = block.getDefaultData()
					if (!template)
						template = block.getDefaultTemplate()
					if (!directives)
						directives = block.getDefaultDirectives()
						
					
					this.refreshBlock(block, contextFactory(data, template, directives))
				}
			}
			
			this.refreshBlock = function(block, context)
			{
				var self = this;
				
				
				context.loadData(function(data, template, directives, errors) {
					if (errors.length)
					{
						getServices().handle500(errors, self);
					}
					else
					{
						block.setData(data)
						block.setTemplate(template)
						block.setDirectives(directives)

						block.render()
					}
				})
			}
		}

		var Link = function(root)
		{
			this.root = root;

			this.getDataURL = function()
			{
				return $(this.root).attr("href");
			}

			this.getTemplateURL = function()
			{
				if ($(this.root).attr("data-template"))
					return $(this.root).attr("data-template");
				else
					throw new Error("Template not defined")
			}
		}

		var Context = function(data, template, directives)
		{
			this.dataName = data
			this.templateName = template
			this.directives = directives
			
			this.loadData = function(callback)
			{
				var context = getServices().getLoader()
				
				context.load(this.dataName, this.templateName, this.directives, callback);
				
			}
			
			this.getDataURL = function()
			{
				return this.dataName;
			}

			this.getTemplateURL = function()
			{
				return this.templateName;
			}

			this.getDirectiveURL = function()
			{
				return this.directives;
			}
		}
		
		var Module = function(root)
		{
			this.root = root;

			this.inited = false

			this.template = ""
			this.data = null
			this.directives = null;

			this.isActive = function()
			{
				return this.inited;
			}

			this.hasDirectives = function()
			{
				if (this.directives == null)
					return false;

				return !$.isEmptyObject(this.directives);
			}

			this.getDirectives = function()
			{
				return this.directives;
			}

			this.setDirectives = function(directives)
			{
				this.directives = directives;
			}

			this.getRoot = function()
			{
				return this.root
			}

			this.setRoot = function(value)
			{
				this.root = value;
			}

			this.nameIs = function(name)
			{
				return (this.getName() == name)
			}

			this.getName = function()
			{
				return $(this.getRoot()).attr("id")
			}

			this.getDefaultData = function()
			{
				return $(this.getRoot()).attr("data-initial-data")
			}

			this.getDefaultTemplate = function()
			{
				return $(this.getRoot()).attr("data-initial-template")
			}

			this.getDefaultDirectives = function()
			{
				return $(this.getRoot()).attr("data-initial-directives")
			}

			this.render = function()
			{
				var self = this;

				$(this.getRoot()).html(this.getTemplate())
				
				if (!this.hasDirectives())
					var t = $(this.getRoot()).autoRender(this.getData())
				else
				{
					var t = $(this.getRoot()).render(this.getData(), this.getDirectives())
				}

				this.setRoot(t)
				
				getServices().initJS(t)
			}

			this.getTemplate = function()
			{
				if (this.template == null)
					throw new Error("No template loaded")

				return this.template;
			}

			this.setTemplate = function(value)
			{
				this.template = value;
			}

			this.getData = function()
			{
				if (this.data == null)
					throw new Error("No data loaded")

				return this.data;
			}

			this.setData = function(value)
			{
				this.data = value;
			}
		}

		return function(serviceProvider) { // used to inject external services into the scope
			services = serviceProvider
			var c = new Core();
			c.init();
			return c;
		};

	})()
	
	var LoaderContext = function(dataEndpoint, templateEndpoint, directiveEndpoint)
	{
		this.dataEndpoint = dataEndpoint
		this.templateEndpoint = templateEndpoint;
		this.directiveEndpoint = directiveEndpoint

		this.load = function(dataURL, templateURL, directiveURL, callback)
		{
			var locks = []

			var template;
			var data = {};
			var directives = {};
			var errors = []

			function handleError(e)
			{
				try {
					errors.push(getServices().parseJSON(e.responseText))
				} catch(e)
				{
					if (e.json)
						errors.push({
							"message": "Error parsing JSON"
						})
					else
						throw e
				}
				locks.pop()
				complete()
			}

			function complete()
			{
				if (locks.length == 0)
				{
					callback(data, template, directives, errors)
				}
			}

			if (dataURL)
			{
				locks.push("anonymous")
				this.loadData(dataURL, function(value) {
					data = value
					locks.pop()
					complete()
				}, handleError)


			}

			locks.push("anonymous")
			this.loadTemplate(templateURL, function(value) {
				template = value

				locks.pop()
				complete()
			}, handleError)

			if (directiveURL)
			{
				locks.push("anonymous")
				this.loadDirective(directiveURL, function(value) {
					directives = value

					locks.pop()
					complete()
				}, handleError)
			}
		}

		this.loadTemplate = function(name, callback, error)
		{
			getServices().loadAjax(this.templateEndpoint + name + ".html", function(value) {
				callback(value)
			}, error)
		}

		this.loadData = function(name, callback, error)
		{
			var self = this
			getServices().loadAjax(this.getDataUrl(name), function(value) {
				try {
					callback(getServices().parseJSON(value))
				} catch (e)
				{
					if (e.json)
						error({"message" : "Can\'t parse JSON response"})
					else
						throw e
				}
			}, error)
		}

		this.getDataUrl = function(name) 
		{
			return this.dataEndpoint + name + ".json";
		}

		this.loadDirective = function(name, callback, error)
		{
			var self = this
			getServices().loadAjax(this.directiveEndpoint + name + ".json", function(value) {
				try{
					callback(getServices().parseJSON(value))
				} catch (e)
				{
					if (e.json)
						error({"message": "Can\'t parse JSON response"})
					else
						throw e
				}
			}, error)
		}
	}
	
	var ErrorContext = function(errors, template, directives)
	{
		this.errors = errors;
		this.template = template;
		this.directives = directives;
		
		this.loadData = function(callback)
		{
			var context = getServices().getLoader()
			var self = this
			
			context.load("", this.template, this.directives, 
				function(data, template, directives, errors) {
					callback(self.errors, template, directives, errors)
				})
		}
	}
	
	
	var Services = function(base)
	{
		if (!base)
			base = "/kangaroo"

		this.base = base

		
		var AJAXError = function(jqXHR)
		{
			this.jqXHR = jqXHR;
		}
		AJAXError.prototype = Error.prototype

		this.loadPageMap = function(callback)
		{
			var self = this
			self.loadAjax("/sitemap.json", function(value) {
				var pa = self.parseJSON(value)
				pa = self.preprocessSitemap(pa)
				console.log(pa)
				callback(pa)
			})
		}

		this.handle404 = function(e, core)
		{
			var page = core.pageMap.getPage("/404")
			core.history.push(page)
		}
		
		this.handle500 = function(e, core)
		{
			core.renderPage(core.pageMap.getPage("/500"), function(dataName, templateName, directiveName) {
				return new ErrorContext({
					"errors": e
				}, templateName, directiveName)
			})
		}
		
		this.preprocessSitemap = function(sitemap)
		{
			
			// This is hard to read. It's hard to read because it's compiled with CoffeeScript. It should be implemented in JS.
			
			var preprocess = (function() {
			  var BaseNode, Block, Node, flattenSitemap, parseNestedSitemap,
			    __hasProp = {}.hasOwnProperty,
			    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

			  BaseNode = (function() {

			    BaseNode.name = 'BaseNode';

			    function BaseNode(children) {
			      this.children = children != null ? children : {};
			    }

			    BaseNode.prototype.append = function(other) {
			      return new Node(other.url, this.mergeChildren(other.children));
			    };

			    BaseNode.prototype.mergeChildren = function(children) {
			      var child, inherit, name, parent, result, _ref;
			      result = {};
			      inherit = function(child, parent, name) {
			        return child[name] || child[name] !== null && parent[name];
			      };
			      for (name in children) {
			        child = children[name];
			        parent = this.children[name];
			        if (parent) {
			          child = new Block(name, inherit(child, parent, "template"), inherit(child, parent, "data"), inherit(child, parent, "directives"));
			        }
			        result[name] = child;
			      }
			      _ref = this.children;
			      for (name in _ref) {
			        parent = _ref[name];
			        child = children[name];
			        if (child) {
			          parent = new Block(name, inherit(child, parent, "template"), inherit(child, parent, "data"), inherit(child, parent, "directives"));
			        }
			        result[name] = parent;
			      }
			      return result;
			    };

			    BaseNode.prototype.addChild = function(child) {
			      return this.children[child.name] = child;
			    };

			    return BaseNode;

			  })();

			  Node = (function(_super) {

			    __extends(Node, _super);

			    Node.name = 'Node';

			    function Node(url, children) {
			      this.url = url;
			      this.children = children != null ? children : {};
			    }

			    Node.prototype.append = function(other) {
			      return new Node(this.url + other.url, this.mergeChildren(other.children));
			    };

			    return Node;

			  })(BaseNode);

			  Block = (function() {

			    Block.name = 'Block';

			    function Block(name, template, data, directives) {
			      this.name = name;
			      this.template = template;
			      this.data = data;
			      this.directives = directives;
			    }

			    return Block;

			  })();

			  parseNestedSitemap = function(map, baseNode) {
			    var key, l, newNode, node, result, url, value, _i, _j, _len, _len1, _ref;
			    l = [];
			    for (key in map) {
			      value = map[key];
			      if ((key.charAt(0)) === "#") {
			        url = key.substr(1);
			        newNode = new Node(url);
			        l.push(newNode);
			        _ref = parseNestedSitemap(value, newNode);
			        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
			          node = _ref[_i];
			          l.push(node);
			        }
			      } else if ((key.charAt(0)) === "$") {
			        baseNode.addChild(new Block(key.substr(1), value.template, value.data, value.directives));
			      }
			    }
			    result = [];
			    for (_j = 0, _len1 = l.length; _j < _len1; _j++) {
			      node = l[_j];
			      result.push(baseNode.append(node));
			    }
			    return result;
			  };

			  flattenSitemap = function(pages) {
			    var child, data, map, name, page, _i, _len, _ref;
			    map = {};
			    for (_i = 0, _len = pages.length; _i < _len; _i++) {
			      page = pages[_i];
			      data = {};
			      _ref = page.children;
			      for (name in _ref) {
			        child = _ref[name];
			        data[child.name] = {
			          template: child.template,
			          data: child.data,
			          directives: child.directives
			        };
			      }
			      map[page.url] = data;
			    }
			    return map;
			  };

			  return function(sitemap) {
			    return flattenSitemap(parseNestedSitemap(sitemap, new BaseNode));
			  };

			}).call(this);
			
			
			return preprocess(sitemap)
		}

		this.loadAjax = function(url, callback, error)
		{
			var self = this;
			
			$.ajax({
				url: url,
				dataType:"text",
				success: function(data, textStatus, jqXHR)
				{
					callback(data);
				},
				error: error
			})
		}
		
		this.initJS = function(element)
		{
			
		}

		this.sanitizeJSON = function(json)
		{
			json = json.replace(/\n/g, " ")
			json = json.replace(/\t/g, "    ")
			return json;
		}

		this.parseJSON = function(json)
		{
			json = this.sanitizeJSON(json)

			try{
				return $.parseJSON(json)
			} catch (e)
			{
				throw new ParsingError("Error parsing JSON", json)
			}
		}

		this.loadTemplate = function(name, callback)
		{
			this.loadAjax(this.base + name)
		}

		this.getLoader = function() {
			return new LoaderContext("content/data/", "content/template/", "content/directives/");
		}

		this.getCurrentURLHash = function() {
			return document.location.hash.substr(1) || "/";
		}
	}
	
	function ParsingError(message, json)
	{
		this.message = message
		this.json = json
	}
	ParsingError.prototype = Error.prototype
	
	return { 
		Kangaroo: kangaroo,
		Services: Services,
		LoaderContext: LoaderContext
	}
	
})	
