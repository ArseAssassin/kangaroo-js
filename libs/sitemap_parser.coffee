class BaseNode
	constructor: (@children={}) ->
	append: (other) -> (new Node other.url, 
		this.mergeChildren(other.children)
	)
	
	mergeChildren: (children) ->
		result = {}
		inherit = (child, parent, name) -> child[name] or child[name] != null and parent[name]

		for name, child of children
			parent = @children[name]
			
			if parent
				child = new Block name, 
					(inherit child, parent, "template"),
					(inherit child, parent, "data"),
					(inherit child, parent, "directives")
				
				
			result[name] = child
			
		for name, parent of @children
			child = children[name]
			
			if child
				parent = new Block(name,
					inherit(child, parent, "template"),
					inherit(child, parent, "data"),
					inherit(child, parent, "directives")
				)
				
			result[name] = parent
			
		result
	
	addChild: (child) -> 
		@children[child.name] = child
	
	
class Node extends BaseNode
	constructor: (@url, @children={}) ->
		
	append: (other) -> (new Node @url + other.url, 
		this.mergeChildren(other.children)
	)
	
	
	
	
class Block
	constructor: (@name, @template, @data, @directives) ->
	

parseNestedSitemap = (map, baseNode) -> 
	l = []
	for key, value of map
		if (key.charAt 0) == "#"
			url = key.substr 1
			newNode = new Node url
			
			l.push newNode
			
			for node in (parseNestedSitemap value, 
				newNode)
				l.push node
		else if (key.charAt 0) == "$"
			baseNode.addChild (new Block key.substr(1), value.template, value.data, value.directives)
			
		
	result = []		
	for node in l
		result.push baseNode.append(node)
		
	return result
	

flattenSitemap = (pages) -> 
	map = {}
	for page in pages
		data = {}
		
		for name, child of page.children
			data[child.name] = {
				template: child.template,
				data: child.data,
				directives: child.directives
			}
		
		map[page.url] = data
		
	map

# console.log "--------------------"
# 			
# console.log flattenSitemap (parseNestedSitemap {
# 	"#/main": {
# 		"$navi": {
# 			"template": "navitemplate",
# 			"data": "navi"
# 		},
# 		
# 		"#/sub1": {
# 			"$main": {
# 				"template": "main1"
# 			},
# 			
# 			"$navi": {
# 				"data": "hello"
# 			}
# 		},
# 
# 		"#/sub2": {
# 			"$main": {
# 				"template": "main2"
# 			}
# 		},
# 
# 		"#/sub3": {
# 			"$main": {
# 				"template": "main3"
# 			}
# 		}
# 	}
# }, new BaseNode)


return (sitemap) -> flattenSitemap parseNestedSitemap sitemap, new BaseNode