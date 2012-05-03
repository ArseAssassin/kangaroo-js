class BaseNode
	constructor: (@children=[]) ->
	append: (other) -> new Node other.url, @children
	
	addChild: (child) -> @children.push child
	
	
class Node extends BaseNode
	constructor: (@url, @children=[]) ->
		
	append: (other) -> (new Node @url + other.url, @children.concat other.children)
		
	addChild: (child) -> @children.push child
	
	
	
class Block
	constructor: (@name, @template, @data, @directives) ->
	

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
		else if (key.charAt 0) == "$"
			baseNode.addChild (new Block key.substr(1), value.template, value.data, value.directives)
			
				
	l
	

flattenSitemap = (pages) -> 
	map = {}
	for page in pages
		data = {}
		
		for child in page.children
			data[child.name] = {
				template: child.template,
				data: child.data,
				directives: child.directives
			}
		
		map[page.url] = data
		
	map

console.log "--------------------"
			
console.log flattenSitemap (parseNestedSitemap {
	"#/main": {
		"$navi": {
			"template": "navitemplate"
		},
		
		"#/sub1": {
			"$main": {
				"template": "main1"
			}
		},

		"#/sub2": {
			"$main": {
				"template": "main2"
			}
		},

		"#/sub3": {
			"$main": {
				"template": "main3"
			}
		}
	}
}, new BaseNode)


return (sitemap) -> flattenSitemap parseNestedSitemap sitemap, new BaseNode