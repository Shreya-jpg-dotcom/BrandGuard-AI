export function applyExactTextPatch(source,start,end,expected,replacement){
 const text=String(source??'');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>text.length)throw Object.assign(new Error('The correction span is invalid.'),{status:400});
 if(typeof expected!=='string'||text.slice(start,end)!==expected)throw Object.assign(new Error('The selected text changed. Revalidate this suggestion.'),{status:409});
 if(typeof replacement!=='string'||!replacement.trim())throw Object.assign(new Error('Replacement text is required.'),{status:400});
 return text.slice(0,start)+replacement+text.slice(end);
}
