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
					self.addPageAndRender(document.location.hash.substr(1))
				})

				$("*[data-elementtype='module']").each(function() {
					var a = new Module(this)
					self.addBlock(a)
				})

				this.loadPageMap(function(pageMap) {
					self.pageMap = pageMap

					var url = document.location.hash.substr(1)

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
				getServices().loadAjax("/static/sitemap.json", function(value) {
					callback(new PageMap(getServices().parseJSON(value)))
				})
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

		this.handle404 = function(e, core)
		{
			core.history.push(core.pageMap.getPage("/404"))
		}
		
		this.handle500 = function(e, core)
		{
			core.renderPage(core.pageMap.getPage("/500"), function(dataName, templateName, directiveName) {
				return new ErrorContext({
					"errors": e
				}, templateName, directiveName)
			})
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
