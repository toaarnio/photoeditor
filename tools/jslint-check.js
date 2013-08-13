load("tools/jslint.js");

var ok = {
	"Expected an identifier and instead saw 'undefined' (a reserved word).": true,
	"Use '===' to compare with 'null'.": true,
	"Use '!==' to compare with 'null'.": true,
	"Expected an assignment or function call and instead saw an expression.": true,
	"Expected a 'break' statement before 'case'.": true,
	"Don't make functions within a loop.": true
};

var errors = 0;

print();

function lintFile(name)
{
	var dta = readFile(name);
	
	JSLINT(dta, {maxerr: 999999999, forin: true});
	
	var e = JSLINT.errors, found = 0, w, i;
	
	for (i=0; i < e.length; i++) {
		w = e[i];
		if (!w) continue;
		
		if (ok[w.reason]) continue;
		
		errors ++;
		
		print(name + ":" + w.line + ": error: " + w.reason);
	}
}

for (var i=0; i < arguments.length; i++) {
	lintFile(arguments[i]);
}

if ( errors > 0 ) {
	print( "\nJSLint: " + errors + " error(s) found." );
} else {
	print( "JSLint check passed." );
}

print();