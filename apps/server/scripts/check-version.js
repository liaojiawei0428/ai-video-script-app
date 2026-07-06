const http = require('http');
http.get('http://127.0.0.1:6000/api/version', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const d = JSON.parse(body);
    console.log('version:', d.data.version);
    console.log('changelog:', (d.data.changelog || '').slice(0, 100));
    console.log('highlights[0]:', (d.data.highlights || [])[0] || '');
  });
});
