require(["kangaroo", "order!jquery", "order!jquery_plugins", "order!pure"], function(kangaroo) {
	var services = new kangaroo.Services()
	
	services.initJS = function(node)
	{
		
		$("form", node).submit(function(event) {
			// $(this).hide()
			var form = this;
			$(form).hide()
			$("h1").hide()
			
			$.ajax({
				type: "POST",
				url: $(form).attr("action"),
				data: $(this).serialize(),
				success:function() {
					$(form).after("<h1>Thanks</h1><p>for contacting me. I'll get back to you in 24 hours.</p>")
				},
				error:function() {
					$(form).after("<h1>Something went wrong :(</h1><p>please try again</p>")
					$(form).show()
				}
			})
		
			event.preventDefault()
		})
	}
	
	kangaroo.Kangaroo(services);
	
})