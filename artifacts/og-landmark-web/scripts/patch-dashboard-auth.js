const replacements = [
  {
    description: 'password login session persistence',
    search: 'const o=a.user;return t({currentUser:o,token:a.token,',
    replacement: 'const o=a.user;localStorage.setItem("og_token",a.token);localStorage.setItem("og_user",JSON.stringify(o));return t({currentUser:o,token:a.token,',
  },
  {
    description: 'Google login session persistence',
    search: 'const a=s.user;return t({currentUser:a,token:s.token,',
    replacement: 'const a=s.user;localStorage.setItem("og_token",s.token);localStorage.setItem("og_user",JSON.stringify(a));return t({currentUser:a,token:s.token,',
  },
  {
    description: 'registration session persistence',
    search: 'const a=s.user;if(a.role==="Seller"||a.role==="Agent"){localStorage.setItem("og_token",s.token);localStorage.setItem("og_user",JSON.stringify(a));window.location.href=',
    replacement: 'const a=s.user;localStorage.setItem("og_token",s.token);localStorage.setItem("og_user",JSON.stringify(a));if(a.role==="Seller"||a.role==="Agent"){window.location.href=',
  },
  {
    description: 'logout session cleanup',
    search: 'logout:()=>{t({currentUser:null,token:null,currentBuyerId:4,currentSellerId:10})}',
    replacement: 'logout:()=>{localStorage.removeItem("og_token");localStorage.removeItem("og_user");t({currentUser:null,token:null,currentBuyerId:4,currentSellerId:10})}',
  },
];

function countOccurrences(source, search) {
  let count = 0;
  let position = 0;
  while ((position = source.indexOf(search, position)) !== -1) {
    count += 1;
    position += search.length;
  }
  return count;
}

function patchDashboardAuth(source) {
  let patched = source;
  for (const { description, search, replacement } of replacements) {
    const count = countOccurrences(patched, search);
    if (count !== 1) {
      throw new Error(`Could not apply ${description}: expected one bundle match, found ${count}.`);
    }
    patched = patched.replace(search, replacement);
  }
  return patched;
}

module.exports = patchDashboardAuth;
