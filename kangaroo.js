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

				throw new Error("Invalid page name " + name)
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

					if (!module.object.isActive())
						module.object.initDefault()
				}
			}

			this.loadPageMap = function(callback)
			{
				var self = this
				getServices().loadAjax("sitemap.json", function(value) {
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
				var page = this.pageMap.getPage(name)
				this.history.push(page)
			}

			this.getCurrentPage = function()
			{
				return this.history[this.history.length-1]
			}

			this.renderCurrent = function()
			{
				var page = this.getCurrentPage()

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
					
					block.refresh(new Context(
						data, template, directives
					))
				}


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
				return this.directives ? this.directives : "";
			}
		}
		
		var Module = function(root)
		{
			this.root = root;

			this.loader = getServices().getLoader();

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

			this.initDefault = function()
			{
				this.refresh(
					new Context(
						this.getDefaultData(),
						this.getDefaultTemplate(),
						this.getDefaultDirectives()
					)
				)
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
			}

			this.getTemplate = function()
			{
				if (!this.template)
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

			this.refresh = function(link)
			{
				var self = this;

				self.inited = true

				this.loader.load(
					link.getDataURL(),
					link.getTemplateURL(),
					link.getDirectiveURL(),
					function(data, template, directives) {
						self.setData(data)
						self.setTemplate(template)
						self.setDirectives(directives)

						self.render()
					}
				)
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
			var locks = [
				"anonymous"
			]

			var template;
			var data = {};
			var directives = {};


			function complete()
			{
				if (locks.length == 0)
				{
					callback(data, template, directives)
				}
			}

			if (dataURL)
			{
				locks.push("anonymous")
				this.loadData(dataURL, function(value) {
					data = value
					locks.pop()
					complete()
				})


			}

			this.loadTemplate(templateURL, function(value) {
				template = value

				locks.pop()
				complete()
			})

			if (directiveURL)
			{
				locks.push("anonymous")
				this.loadDirective(directiveURL, function(value) {
					directives = value

					locks.pop()
					complete()
				})
			}
		}

		this.loadTemplate = function(name, callback)
		{
			getServices().loadAjax(this.templateEndpoint + name + ".html", function(value) {
				callback(value)
			})
		}

		this.loadData = function(name, callback)
		{
			var self = this
			getServices().loadAjax(this.dataEndpoint + name + ".json", function(value) {
				callback(getServices().parseJSON(value))
			})
		}

		this.loadDirective = function(name, callback)
		{
			var self = this
			getServices().loadAjax(this.directiveEndpoint + name + ".json", function(value) {
				callback(getServices().parseJSON(value))
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

		this.loadAjax = function(url, callback)
		{
			$.ajax({
				url: url,
				dataType:"text",
				success: function(data, textStatus, jqXHR)
				{
					callback(data);
				},
				error: function(jqXHR, textStatus, errorThrown)
				{
					throw new AJAXError(jqXHR)
				}
			})
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
				throw new Error("Error parsing JSON: " + json)
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
	
	return { 
		Kangaroo: kangaroo,
		Services: Services,
		LoaderContext: LoaderContext
	}
	
})	
