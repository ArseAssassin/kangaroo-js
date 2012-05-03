class Node
	constructor: (@url, @template, @data, @directives) ->
		
	append: (other) -> (new Node @url + other.url, 
		other.template or if other.template != null then @template, 
		other.data or if other.data != null then  @data, 
		other.directives or if other.directives != null then  @directives)
	
	
class BaseNode
	constructor: () ->
	append: (other) -> other
	

parseNestedSitemap = (map, baseNode) -> 
	l = []
	for key, value of map
		if (key.charAt 0) == "#"
			url = key.substr 1
			template = value.template
			data = value.data
			directives = value.directives
			
			
			newNode = baseNode.append (new Node url, template, data, directives)
			
			l.push newNode
			
			for node in (parseNestedSitemap value, newNode)
				l.push node
				
	l
	

flattenSitemap = (pages) -> 
	map = {}
	for page in pages
		data = {
			template: page.template,
			data: page.data,
			directives: page.directives
		}
		
		map[page.url] = data
		
	map
			
console.log "-------------------"
console.log flattenSitemap (parseNestedSitemap {
	"#/main": {
		"template": "hi",
		"data": "maindata",
		
		"#/template" : {
			"template": "dude",
			"data" : "templatedata",
			"directives": "dude",
			
			"#/we_must_go_deeper": {
				"template": "deeper",
				"data": "deepdata",
				"directives": null
			}
		}
	},
	
	"#/anothertree": {
		"template": "another_template",
		"#/leaf1": {
			"#/subleaf": {
				"data": "subleafdata"
			},
			"template": "leaftemplate",
			"data": "leaf1data"
		},
		
		"#/leaf2": {
			"template": "leaftemplate",
			"data": "leaf2data"
		}
	}
}, new BaseNode)
