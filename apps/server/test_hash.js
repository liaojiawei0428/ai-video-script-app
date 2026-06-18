const bcrypt = require('bcryptjs');
bcrypt.hash('wuliao', 10).then(h => {
    console.log('Hash:', h);
    console.log('Prefix:', h.substring(0, 7));
    bcrypt.compare('wuliao', h).then(r => console.log('Verify:', r));
});
