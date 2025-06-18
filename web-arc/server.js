const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Add this after your imports
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
    process.exit(1);
}

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Create new user
app.post('/api/users', async (req, res) => {
    const { name, age, gender, location, profession, isTypeDesigner, socialLink } = req.body;
    
    if (!name || !age || !gender || !location || !profession || isTypeDesigner === undefined) {
        return res.status(400).json({
            success: false,
            message: 'All required fields must be provided'
        });
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid age between 1 and 120'
        });
    }

    const { data, error } = await supabase
        .from('users')
        .insert([{
            name,
            age: ageNum,
            gender,
            location,
            profession,
            is_type_designer: isTypeDesigner === 'yes',
            social_link: socialLink || null
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not create user'
        });
    }

    res.json({
        success: true,
        uid: data.uid,
        message: 'User created successfully'
    });
});

// 2. Get random font
app.get('/api/fonts/random', async (req, res) => {
    const { data, error } = await supabase
        .from('fonts')
        .select('*');

    if (error) {
        console.error('Error fetching fonts:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not fetch fonts'
        });
    }

    if (!data || data.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'No fonts available in database'
        });
    }

    const randomFont = data[Math.floor(Math.random() * data.length)];
    
    res.json({
        success: true,
        font: {
            fontId: randomFont.font_id,
            fontName: randomFont.font_name,
            imagePath: randomFont.image_path
        }
    });
});

// 3. Submit survey
app.post('/api/surveys', async (req, res) => {
    const {
        uid,
        fontId,
        decorativeness,
        vibes,
        customVibes,
        useCases,
        customUseCases
    } = req.body;

    if (!uid || !fontId || decorativeness === undefined) {
        return res.status(400).json({
            success: false,
            message: 'UID, fontID, and decorativeness are required'
        });
    }

    const decorNum = parseInt(decorativeness);
    if (isNaN(decorNum) || decorNum < 0 || decorNum > 9) {
        return res.status(400).json({
            success: false,
            message: 'Decorativeness must be a number between 0 and 9'
        });
    }

    const { data, error } = await supabase
        .from('surveys')
        .insert([{
            uid,
            font_id: fontId,
            decorativeness: decorNum,
            vibes: vibes || [],
            custom_vibes: customVibes || [],
            use_cases: useCases || [],
            custom_use_cases: customUseCases || []
        }])
        .select()
        .single();

    if (error) {
        console.error('Error submitting survey:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not submit survey'
        });
    }

    res.json({
        success: true,
        surveyId: data.survey_id,
        message: 'Survey submitted successfully'
    });
});

// 4. Get all survey data (for analysis)
app.get('/api/admin/surveys', async (req, res) => {
    const { data, error } = await supabase
        .from('surveys')
        .select(`
            *,
            users(*),
            fonts(*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching surveys:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not fetch surveys'
        });
    }

    res.json({
        success: true,
        surveys: data,
        count: data.length
    });
});

// 5. Export data as CSV
app.get('/api/admin/export/csv', async (req, res) => {
    const { data, error } = await supabase
        .from('surveys')
        .select(`
            *,
            users(*),
            fonts(*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching data for export:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not export data'
        });
    }

    let csv = 'survey_id,uid,name,age,gender,location,profession,is_type_designer,social_link,font_id,font_name,decorativeness,vibes,custom_vibes,use_cases,custom_use_cases,created_at\n';

    data.forEach(row => {
        const cleanString = (str) => {
            if (!str) return '';
            return `"${str.toString().replace(/"/g, '""')}"`;
        };

        csv += `${row.survey_id},${row.uid},${cleanString(row.users.name)},${row.users.age},${cleanString(row.users.gender)},${cleanString(row.users.location)},${cleanString(row.users.profession)},${row.users.is_type_designer},${cleanString(row.users.social_link)},${row.font_id},${cleanString(row.fonts.font_name)},${row.decorativeness},${cleanString(JSON.stringify(row.vibes))},${cleanString(JSON.stringify(row.custom_vibes))},${cleanString(JSON.stringify(row.use_cases))},${cleanString(JSON.stringify(row.custom_use_cases))},${cleanString(row.created_at)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="survey_data.csv"');
    res.send(csv);
});

// 6. Get database stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const [usersResult, surveysResult, fontsResult] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('surveys').select('*', { count: 'exact', head: true }),
            supabase.from('fonts').select('*', { count: 'exact', head: true })
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: usersResult.count,
                totalSurveys: surveysResult.count,
                totalFonts: fontsResult.count
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Could not fetch stats'
        });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/page2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page2.html'));
});

app.get('/page3', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page3.html'));
});

app.get('/page4', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page4.html'));
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
// For Vercel (add this line at the very end)
module.exports = app;

// // const express = require('express');
// // const sqlite3 = require('sqlite3').verbose();
// // const cors = require('cors');
// // const bodyParser = require('body-parser');
// // const path = require('path');
// // const fs = require('fs');

// // const app = express();
// // const PORT = process.env.PORT || 3000;

// // // Middleware
// // app.use(cors());
// // app.use(bodyParser.json());
// // app.use(bodyParser.urlencoded({ extended: true }));

// // // Serve static files (HTML, CSS, images) from public directory
// // app.use(express.static(path.join(__dirname, 'public')));

// // // IMPORTANT: Serve font images with correct path
// // app.use('/font-images', express.static(path.join(__dirname, 'public', 'font images')));

// // // Create public directory if it doesn't exist
// // const publicDir = path.join(__dirname, 'public');
// // if (!fs.existsSync(publicDir)) {
// //     fs.mkdirSync(publicDir, { recursive: true });
// //     console.log('Created public directory');
// // }

// // // Initialize SQLite database
// // const db = new sqlite3.Database('./survey_database.db', (err) => {
// //     if (err) {
// //         console.error('Error opening database:', err.message);
// //     } else {
// //         console.log('Connected to SQLite database');
// //         initializeDatabase();
// //     }
// // });

// // // Function to read font images from directory
// // function loadFontImagesFromDirectory() {
// //     const fontImagesDir = path.join(__dirname, 'public', 'font images');
    
// //     // Check if directory exists
// //     if (!fs.existsSync(fontImagesDir)) {
// //         console.error(`Font images directory not found: ${fontImagesDir}`);
// //         return [];
// //     }
    
// //     try {
// //         // Read all files from the directory
// //         const files = fs.readdirSync(fontImagesDir);
        
// //         // Filter only image files
// //         const imageFiles = files.filter(file => {
// //             const ext = path.extname(file).toLowerCase();
// //             return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
// //         });
        
// //         const fonts = [];
        
// //         // Process each image file
// //         imageFiles.forEach(file => {
// //             // Extract font information from filename
// //             const regex = /text-(\d+)-(.+)\.png/;
// //             const match = file.match(regex);
            
// //             if (match) {
// //                 // Font ID and name extracted from filename
// //                 const fontId = parseInt(match[1]);
// //                 const fontName = match[2];
                
// //                 fonts.push({
// //                     font_id: fontId,
// //                     font_name: fontName,
// //                     image_path: file
// //                 });
// //             } else if (file === 'text1.png') {
// //                 // Special case for text1.png
// //                 fonts.push({
// //                     font_id: 1,
// //                     font_name: 'Sample Font 1',
// //                     image_path: file
// //                 });
// //             }
// //         });
        
// //         return fonts;
// //     } catch (err) {
// //         console.error('Error reading font images directory:', err);
// //         return [];
// //     }
// // }

// // // Function to initialize database with fonts
// // function initializeFontsTable() {
// //     db.run(`CREATE TABLE IF NOT EXISTS fonts (
// //         font_id INTEGER PRIMARY KEY,
// //         font_name TEXT NOT NULL,
// //         image_path TEXT NOT NULL,
// //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// //     )`, (err) => {
// //         if (err) {
// //             console.error('Error creating fonts table:', err);
// //             return;
// //         }
        
// //         // Load fonts from directory
// //         const fonts = loadFontImagesFromDirectory();
        
// //         if (fonts.length === 0) {
// //             console.log('No font images found in directory');
// //             return;
// //         }
        
// //         // Check if fonts already exist in the database
// //         db.get('SELECT COUNT(*) as count FROM fonts', (err, row) => {
// //             if (err) {
// //                 console.error('Error checking fonts:', err);
// //                 return;
// //             }
            
// //             // Only insert fonts if the table is empty or fewer fonts than available
// //             if (row.count < fonts.length) {
// //                 // Clear existing fonts and re-insert all
// //                 db.run('DELETE FROM fonts', (err) => {
// //                     if (err) {
// //                         console.error('Error clearing fonts table:', err);
// //                         return;
// //                     }
                    
// //                     // Insert each font into the database
// //                     fonts.forEach(font => {
// //                         db.run(
// //                             'INSERT INTO fonts (font_id, font_name, image_path) VALUES (?, ?, ?)',
// //                             [font.font_id, font.font_name, font.image_path],
// //                             (err) => {
// //                                 if (err) {
// //                                     console.error(`Error inserting font ${font.font_name}:`, err);
// //                                 } else {
// //                                     console.log(`Inserted font: ${font.font_name} (ID: ${font.font_id})`);
// //                                 }
// //                             }
// //                         );
// //                     });
                    
// //                     console.log(`Loaded ${fonts.length} fonts from directory`);
// //                 });
// //             } else {
// //                 console.log(`${row.count} fonts already exist in database`);
// //             }
// //         });
// //     });
// // }

// // // Initialize database tables
// // function initializeDatabase() {
// //     db.serialize(() => {
// //         // Users table
// //         db.run(`CREATE TABLE IF NOT EXISTS users (
// //             uid INTEGER PRIMARY KEY AUTOINCREMENT,
// //             name TEXT NOT NULL,
// //             age INTEGER NOT NULL,
// //             gender TEXT NOT NULL,
// //             location TEXT NOT NULL,
// //             profession TEXT NOT NULL,
// //             is_type_designer BOOLEAN NOT NULL,
// //             social_link TEXT,
// //             created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// //         )`);

// //         // Initialize fonts table with all images
// //         initializeFontsTable();

// //         // Surveys table
// //         db.run(`CREATE TABLE IF NOT EXISTS surveys (
// //             survey_id INTEGER PRIMARY KEY AUTOINCREMENT,
// //             uid INTEGER NOT NULL,
// //             font_id INTEGER NOT NULL,
// //             decorativeness INTEGER NOT NULL,
// //             vibes TEXT NOT NULL,
// //             custom_vibes TEXT NOT NULL,
// //             use_cases TEXT NOT NULL,
// //             custom_use_cases TEXT NOT NULL,
// //             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
// //             FOREIGN KEY (uid) REFERENCES users (uid),
// //             FOREIGN KEY (font_id) REFERENCES fonts (font_id)
// //         )`, (err) => {
// //             if (err) {
// //                 console.error('Error creating surveys table:', err);
// //             }
// //         });
// //     });
    
// //     console.log('Database initialized successfully');
// // }

// // // API Routes

// // // 1. Create new user
// // app.post('/api/users', (req, res) => {
// //     const { name, age, gender, location, profession, isTypeDesigner, socialLink } = req.body;
    
// //     // Validation
// //     if (!name || !age || !gender || !location || !profession || isTypeDesigner === undefined) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'All required fields must be provided'
// //         });
// //     }

// //     // Validate age
// //     const ageNum = parseInt(age);
// //     if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'Please enter a valid age between 1 and 120'
// //         });
// //     }

// //     const sql = `INSERT INTO users (name, age, gender, location, profession, is_type_designer, social_link)
// //                  VALUES (?, ?, ?, ?, ?, ?, ?)`;
// //     const isDesigner = isTypeDesigner === 'yes' ? 1 : 0;

// //     db.run(sql, [name, ageNum, gender, location, profession, isDesigner, socialLink || null], function(err) {
// //         if (err) {
// //             console.error('Error creating user:', err);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not create user'
// //             });
// //         }

// //         console.log(`Created user: ${name} (UID: ${this.lastID})`);
// //         res.json({
// //             success: true,
// //             uid: this.lastID,
// //             message: 'User created successfully'
// //         });
// //     });
// // });

// // // 2. Get random font
// // app.get('/api/fonts/random', (req, res) => {
// //     const sql = 'SELECT * FROM fonts ORDER BY RANDOM() LIMIT 1';

// //     db.get(sql, (err, row) => {
// //         if (err) {
// //             console.error('Error fetching random font:', err);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not fetch font'
// //             });
// //         }

// //         if (!row) {
// //             return res.status(404).json({
// //                 success: false,
// //                 message: 'No fonts available in database'
// //             });
// //         }

// //         console.log(`Serving font: ${row.font_name} (ID: ${row.font_id})`);
// //         res.json({
// //             success: true,
// //             font: {
// //                 fontId: row.font_id,
// //                 fontName: row.font_name,
// //                 imagePath: row.image_path
// //             }
// //         });
// //     });
// // });

// // // 3. Submit survey
// // app.post('/api/surveys', (req, res) => {
// //     const {
// //         uid,
// //         fontId,
// //         decorativeness,
// //         vibes,
// //         customVibes,
// //         useCases,
// //         customUseCases
// //     } = req.body;

// //     // Validation
// //     if (!uid || !fontId || decorativeness === undefined) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'UID, fontID, and decorativeness are required'
// //         });
// //     }

// //     // Validate decorativeness range
// //     const decorNum = parseInt(decorativeness);
// //     if (isNaN(decorNum) || decorNum < 0 || decorNum > 9) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'Decorativeness must be a number between 0 and 9'
// //         });
// //     }

// //     // Verify user exists
// //     db.get('SELECT uid FROM users WHERE uid = ?', [uid], (err, userRow) => {
// //         if (err) {
// //             console.error('Error verifying user:', err);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not verify user'
// //             });
// //         }

// //         if (!userRow) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: 'Invalid user ID'
// //             });
// //         }

// //         // Verify font exists
// //         db.get('SELECT font_id FROM fonts WHERE font_id = ?', [fontId], (err, fontRow) => {
// //             if (err) {
// //                 console.error('Error verifying font:', err);
// //                 return res.status(500).json({
// //                     success: false,
// //                     message: 'Database error: Could not verify font'
// //                 });
// //             }

// //             if (!fontRow) {
// //                 return res.status(400).json({
// //                     success: false,
// //                     message: 'Invalid font ID'
// //                 });
// //             }

// //             // Insert survey
// //             const sql = `INSERT INTO surveys (uid, font_id, decorativeness, vibes, custom_vibes, use_cases, custom_use_cases)
// //                          VALUES (?, ?, ?, ?, ?, ?, ?)`;
// //             const params = [
// //                 uid,
// //                 fontId,
// //                 decorNum,
// //                 JSON.stringify(vibes || []),
// //                 JSON.stringify(customVibes || []),
// //                 JSON.stringify(useCases || []),
// //                 JSON.stringify(customUseCases || [])
// //             ];

// //             db.run(sql, params, function(err) {
// //                 if (err) {
// //                     console.error('Error submitting survey:', err);
// //                     return res.status(500).json({
// //                         success: false,
// //                         message: 'Database error: Could not submit survey'
// //                     });
// //                 }

// //                 console.log(`Survey submitted: User ${uid}, Font ${fontId}, Survey ID ${this.lastID}`);
// //                 res.json({
// //                     success: true,
// //                     surveyId: this.lastID,
// //                     message: 'Survey submitted successfully'
// //                 });
// //             });
// //         });
// //     });
// // });

// // // 4. Get all survey data (for analysis)
// // app.get('/api/admin/surveys', (req, res) => {
// //     const sql = `
// //         SELECT
// //             s.survey_id,
// //             s.uid,
// //             u.name,
// //             u.age,
// //             u.gender,
// //             u.location,
// //             u.profession,
// //             u.is_type_designer,
// //             u.social_link,
// //             s.font_id,
// //             f.font_name,
// //             f.image_path,
// //             s.decorativeness,
// //             s.vibes,
// //             s.custom_vibes,
// //             s.use_cases,
// //             s.custom_use_cases,
// //             s.created_at
// //         FROM surveys s
// //         JOIN users u ON s.uid = u.uid
// //         JOIN fonts f ON s.font_id = f.font_id
// //         ORDER BY s.created_at DESC
// //     `;

// //     db.all(sql, (err, rows) => {
// //         if (err) {
// //             console.error('Error fetching surveys:', err);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not fetch surveys'
// //             });
// //         }

// //         // Parse JSON strings back to arrays
// //         const surveys = rows.map(row => ({
// //             ...row,
// //             vibes: JSON.parse(row.vibes),
// //             custom_vibes: JSON.parse(row.custom_vibes),
// //             use_cases: JSON.parse(row.use_cases),
// //             custom_use_cases: JSON.parse(row.custom_use_cases)
// //         }));

// //         res.json({
// //             success: true,
// //             surveys: surveys,
// //             count: surveys.length
// //         });
// //     });
// // });

// // // 5. Export data as CSV
// // app.get('/api/admin/export/csv', (req, res) => {
// //     const sql = `
// //         SELECT
// //             s.survey_id,
// //             s.uid,
// //             u.name,
// //             u.age,
// //             u.gender,
// //             u.location,
// //             u.profession,
// //             u.is_type_designer,
// //             u.social_link,
// //             s.font_id,
// //             f.font_name,
// //             s.decorativeness,
// //             s.vibes,
// //             s.custom_vibes,
// //             s.use_cases,
// //             s.custom_use_cases,
// //             s.created_at
// //         FROM surveys s
// //         JOIN users u ON s.uid = u.uid
// //         JOIN fonts f ON s.font_id = f.font_id
// //         ORDER BY s.created_at DESC
// //     `;

// //     db.all(sql, (err, rows) => {
// //         if (err) {
// //             console.error('Error fetching data for export:', err);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not export data'
// //             });
// //         }

// //         // Convert to CSV format
// //         let csv = 'survey_id,uid,name,age,gender,location,profession,is_type_designer,social_link,font_id,font_name,decorativeness,vibes,custom_vibes,use_cases,custom_use_cases,created_at\n';

// //         rows.forEach(row => {
// //             const cleanString = (str) => {
// //                 if (!str) return '';
// //                 return `"${str.toString().replace(/"/g, '""')}"`;
// //             };

// //             csv += `${row.survey_id},${row.uid},${cleanString(row.name)},${row.age},${cleanString(row.gender)},${cleanString(row.location)},${cleanString(row.profession)},${row.is_type_designer},${cleanString(row.social_link)},${row.font_id},${cleanString(row.font_name)},${row.decorativeness},${cleanString(row.vibes)},${cleanString(row.custom_vibes)},${cleanString(row.use_cases)},${cleanString(row.custom_use_cases)},${cleanString(row.created_at)}\n`;
// //         });

// //         res.setHeader('Content-Type', 'text/csv');
// //         res.setHeader('Content-Disposition', 'attachment; filename="survey_data.csv"');
// //         res.send(csv);
// //     });
// // });

// // // 6. Get database stats
// // app.get('/api/admin/stats', (req, res) => {
// //     db.serialize(() => {
// //         let stats = {};

// //         db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
// //             if (!err) stats.totalUsers = row.count;
// //         });

// //         db.get('SELECT COUNT(*) as count FROM surveys', (err, row) => {
// //             if (!err) stats.totalSurveys = row.count;
// //         });

// //         db.get('SELECT COUNT(*) as count FROM fonts', (err, row) => {
// //             if (!err) {
// //                 stats.totalFonts = row.count;
// //                 res.json({ success: true, stats });
// //             }
// //         });
// //     });
// // });

// // // Serve HTML files
// // app.get('/', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// // });

// // app.get('/page2', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public', 'page2.html'));
// // });

// // app.get('/page3', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public', 'page3.html'));
// // });

// // app.get('/page4', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public', 'page4.html'));
// // });

// // // Error handling middleware
// // app.use((err, req, res, next) => {
// //     console.error('Unhandled error:', err.stack);
// //     res.status(500).json({
// //         success: false,
// //         message: 'Internal server error'
// //     });
// // });

// // // 404 handler
// // app.use((req, res) => {
// //     res.status(404).json({
// //         success: false,
// //         message: `Route not found: ${req.method} ${req.path}`
// //     });
// // });

// // // Start server
// // app.listen(PORT, () => {
// //     console.log(`=================================`);
// //     console.log(`🚀 Font Survey App Started`);
// //     console.log(`📍 Server: http://localhost:${PORT}`);
// //     console.log(`📊 Admin Panel: http://localhost:${PORT}/api/admin/surveys`);
// //     console.log(`📈 Stats: http://localhost:${PORT}/api/admin/stats`);
// //     console.log(`💾 Export CSV: http://localhost:${PORT}/api/admin/export/csv`);
// //     console.log(`=================================`);
// // });

// // // Graceful shutdown
// // process.on('SIGINT', () => {
// //     console.log('\n🛑 Shutting down gracefully...');
// //     db.close((err) => {
// //         if (err) {
// //             console.error('Error closing database:', err.message);
// //         } else {
// //             console.log('✅ Database connection closed');
// //         }
// //         process.exit(0);
// //     });
// // });

// // process.on('SIGTERM', () => {
// //     console.log('🛑 SIGTERM received, shutting down gracefully...');
// //     db.close(() => {
// //         process.exit(0);
// //     });
// // });


// const express = require('express');
// const sqlite3 = require('sqlite3').verbose();
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Serve static files (HTML, CSS, images) from public directory
// app.use(express.static(path.join(__dirname, 'public')));

// // FIXED: Serve font images with correct path and headers
// app.use('/font-images', express.static(path.join(__dirname, 'public', 'font images'), {
//     setHeaders: (res, path) => {
//         // Set proper content type for images
//         if (path.endsWith('.png')) {
//             res.setHeader('Content-Type', 'image/png');
//         } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
//             res.setHeader('Content-Type', 'image/jpeg');
//         }
//         // Prevent caching issues during development
//         res.setHeader('Cache-Control', 'no-cache');
//     }
// }));

// // Create public directory if it doesn't exist
// const publicDir = path.join(__dirname, 'public');
// if (!fs.existsSync(publicDir)) {
//     fs.mkdirSync(publicDir, { recursive: true });
//     console.log('Created public directory');
// }

// // Create font images directory if it doesn't exist
// const fontImagesDir = path.join(__dirname, 'public', 'font images');
// if (!fs.existsSync(fontImagesDir)) {
//     fs.mkdirSync(fontImagesDir, { recursive: true });
//     console.log('Created font images directory');
// }

// // Initialize SQLite database
// const db = new sqlite3.Database('./survey_database.db', (err) => {
//     if (err) {
//         console.error('Error opening database:', err.message);
//     } else {
//         console.log('Connected to SQLite database');
//         initializeDatabase();
//     }
// });

// // FIXED: Function to read font images from directory with better error handling
// function loadFontImagesFromDirectory() {
//     const fontImagesDir = path.join(__dirname, 'public', 'font images');
    
//     // Check if directory exists
//     if (!fs.existsSync(fontImagesDir)) {
//         console.error(`Font images directory not found: ${fontImagesDir}`);
//         console.log('Please create the directory and add your font images');
//         return [];
//     }
    
//     try {
//         // Read all files from the directory
//         const files = fs.readdirSync(fontImagesDir);
//         console.log(`Found ${files.length} files in font images directory:`, files);
        
//         // Filter only image files
//         const imageFiles = files.filter(file => {
//             const ext = path.extname(file).toLowerCase();
//             return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
//         });
        
//         console.log(`Found ${imageFiles.length} image files:`, imageFiles);
        
//         const fonts = [];
        
//         // Process each image file
//         imageFiles.forEach((file, index) => {
//             // FIXED: Better filename parsing with multiple patterns
//             let fontId, fontName;
            
//             // Try different filename patterns
//             const patterns = [
//                 /text-(\d+)-(.+)\.(png|jpg|jpeg)$/i,  // text-1-fontname.png
//                 /text(\d+)\.(png|jpg|jpeg)$/i,        // text1.png
//                 /font-(\d+)-(.+)\.(png|jpg|jpeg)$/i,  // font-1-fontname.png
//                 /font(\d+)\.(png|jpg|jpeg)$/i,        // font1.png
//                 /(\d+)-(.+)\.(png|jpg|jpeg)$/i,       // 1-fontname.png
//                 /^(.+)\.(png|jpg|jpeg)$/i             // any filename.png
//             ];
            
//             let matched = false;
            
//             for (const pattern of patterns) {
//                 const match = file.match(pattern);
//                 if (match) {
//                     if (match[2] && match[2] !== match[3]) { // Has font name in filename
//                         fontId = parseInt(match[1]) || (index + 1);
//                         fontName = match[2].replace(/[-_]/g, ' ');
//                     } else if (match[1]) { // Just has number
//                         fontId = parseInt(match[1]);
//                         fontName = `Font ${fontId}`;
//                     } else { // Just filename
//                         fontId = index + 1;
//                         fontName = match[1].replace(/[-_]/g, ' ');
//                     }
//                     matched = true;
//                     break;
//                 }
//             }
            
//             if (!matched) {
//                 // Fallback: use index and filename
//                 fontId = index + 1;
//                 fontName = path.parse(file).name.replace(/[-_]/g, ' ');
//             }
            
//             fonts.push({
//                 font_id: fontId,
//                 font_name: fontName,
//                 image_path: `/font-images/${file}` // FIXED: Use correct URL path
//             });
            
//             console.log(`Processed: ${file} -> ID: ${fontId}, Name: ${fontName}`);
//         });
        
//         // Sort by font_id to ensure consistent ordering
//         fonts.sort((a, b) => a.font_id - b.font_id);
        
//         return fonts;
//     } catch (err) {
//         console.error('Error reading font images directory:', err);
//         return [];
//     }
// }

// // Function to initialize database with fonts
// function initializeFontsTable() {
//     db.run(`CREATE TABLE IF NOT EXISTS fonts (
//         font_id INTEGER PRIMARY KEY,
//         font_name TEXT NOT NULL,
//         image_path TEXT NOT NULL,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )`, (err) => {
//         if (err) {
//             console.error('Error creating fonts table:', err);
//             return;
//         }
        
//         // Load fonts from directory
//         const fonts = loadFontImagesFromDirectory();
        
//         if (fonts.length === 0) {
//             console.log('❌ No font images found in directory');
//             console.log(`📁 Please add image files to: ${path.join(__dirname, 'public', 'font images')}`);
//             console.log('📝 Supported formats: .png, .jpg, .jpeg');
//             console.log('📝 Example filenames: text-1-arial.png, text1.png, font-2-helvetica.png');
//             return;
//         }
        
//         // Always refresh fonts table with current directory contents
//         db.run('DELETE FROM fonts', (err) => {
//             if (err) {
//                 console.error('Error clearing fonts table:', err);
//                 return;
//             }
            
//             // Insert each font into the database
//             let insertedCount = 0;
//             fonts.forEach(font => {
//                 db.run(
//                     'INSERT INTO fonts (font_id, font_name, image_path) VALUES (?, ?, ?)',
//                     [font.font_id, font.font_name, font.image_path],
//                     (err) => {
//                         if (err) {
//                             console.error(`Error inserting font ${font.font_name}:`, err);
//                         } else {
//                             insertedCount++;
//                             console.log(`✅ Loaded font: ${font.font_name} (ID: ${font.font_id}) -> ${font.image_path}`);
                            
//                             if (insertedCount === fonts.length) {
//                                 console.log(`🎉 Successfully loaded ${fonts.length} fonts from directory`);
//                             }
//                         }
//                     }
//                 );
//             });
//         });
//     });
// }

// // Initialize database tables
// function initializeDatabase() {
//     db.serialize(() => {
//         // Users table
//         db.run(`CREATE TABLE IF NOT EXISTS users (
//             uid INTEGER PRIMARY KEY AUTOINCREMENT,
//             name TEXT NOT NULL,
//             age INTEGER NOT NULL,
//             gender TEXT NOT NULL,
//             location TEXT NOT NULL,
//             profession TEXT NOT NULL,
//             is_type_designer BOOLEAN NOT NULL,
//             social_link TEXT,
//             created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//         )`);

//         // Initialize fonts table with all images
//         initializeFontsTable();

//         // Surveys table
//         db.run(`CREATE TABLE IF NOT EXISTS surveys (
//             survey_id INTEGER PRIMARY KEY AUTOINCREMENT,
//             uid INTEGER NOT NULL,
//             font_id INTEGER NOT NULL,
//             decorativeness INTEGER NOT NULL,
//             vibes TEXT NOT NULL,
//             custom_vibes TEXT NOT NULL,
//             use_cases TEXT NOT NULL,
//             custom_use_cases TEXT NOT NULL,
//             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//             FOREIGN KEY (uid) REFERENCES users (uid),
//             FOREIGN KEY (font_id) REFERENCES fonts (font_id)
//         )`, (err) => {
//             if (err) {
//                 console.error('Error creating surveys table:', err);
//             }
//         });
//     });
    
//     console.log('Database initialized successfully');
// }

// // ADDED: Debug route to test font image serving
// app.get('/debug/fonts', (req, res) => {
//     const fonts = loadFontImagesFromDirectory();
//     res.json({
//         success: true,
//         fonts: fonts,
//         directory: path.join(__dirname, 'public', 'font images'),
//         directoryExists: fs.existsSync(path.join(__dirname, 'public', 'font images'))
//     });
// });

// // ADDED: Debug route to list all files in font images directory
// app.get('/debug/files', (req, res) => {
//     const fontImagesDir = path.join(__dirname, 'public', 'font images');
//     try {
//         const files = fs.existsSync(fontImagesDir) ? fs.readdirSync(fontImagesDir) : [];
//         res.json({
//             success: true,
//             directory: fontImagesDir,
//             exists: fs.existsSync(fontImagesDir),
//             files: files,
//             imageFiles: files.filter(file => {
//                 const ext = path.extname(file).toLowerCase();
//                 return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
//             })
//         });
//     } catch (error) {
//         res.json({
//             success: false,
//             error: error.message,
//             directory: fontImagesDir
//         });
//     }
// });

// // API Routes

// // 1. Create new user
// app.post('/api/users', (req, res) => {
//     const { name, age, gender, location, profession, isTypeDesigner, socialLink } = req.body;
    
//     // Validation
//     if (!name || !age || !gender || !location || !profession || isTypeDesigner === undefined) {
//         return res.status(400).json({
//             success: false,
//             message: 'All required fields must be provided'
//         });
//     }

//     // Validate age
//     const ageNum = parseInt(age);
//     if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
//         return res.status(400).json({
//             success: false,
//             message: 'Please enter a valid age between 1 and 120'
//         });
//     }

//     const sql = `INSERT INTO users (name, age, gender, location, profession, is_type_designer, social_link)
//                  VALUES (?, ?, ?, ?, ?, ?, ?)`;
//     const isDesigner = isTypeDesigner === 'yes' ? 1 : 0;

//     db.run(sql, [name, ageNum, gender, location, profession, isDesigner, socialLink || null], function(err) {
//         if (err) {
//             console.error('Error creating user:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not create user'
//             });
//         }

//         console.log(`Created user: ${name} (UID: ${this.lastID})`);
//         res.json({
//             success: true,
//             uid: this.lastID,
//             message: 'User created successfully'
//         });
//     });
// });

// // 2. Get random font
// app.get('/api/fonts/random', (req, res) => {
//     const sql = 'SELECT * FROM fonts ORDER BY RANDOM() LIMIT 1';

//     db.get(sql, (err, row) => {
//         if (err) {
//             console.error('Error fetching random font:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not fetch font'
//             });
//         }

//         if (!row) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'No fonts available in database'
//             });
//         }

//         console.log(`Serving font: ${row.font_name} (ID: ${row.font_id}) -> ${row.image_path}`);
//         res.json({
//             success: true,
//             font: {
//                 fontId: row.font_id,
//                 fontName: row.font_name,
//                 imagePath: row.image_path // This should now be /font-images/filename.png
//             }
//         });
//     });
// });

// // 3. Submit survey
// app.post('/api/surveys', (req, res) => {
//     const {
//         uid,
//         fontId,
//         decorativeness,
//         vibes,
//         customVibes,
//         useCases,
//         customUseCases
//     } = req.body;

//     // Validation
//     if (!uid || !fontId || decorativeness === undefined) {
//         return res.status(400).json({
//             success: false,
//             message: 'UID, fontID, and decorativeness are required'
//         });
//     }

//     // Validate decorativeness range
//     const decorNum = parseInt(decorativeness);
//     if (isNaN(decorNum) || decorNum < 0 || decorNum > 9) {
//         return res.status(400).json({
//             success: false,
//             message: 'Decorativeness must be a number between 0 and 9'
//         });
//     }

//     // Verify user exists
//     db.get('SELECT uid FROM users WHERE uid = ?', [uid], (err, userRow) => {
//         if (err) {
//             console.error('Error verifying user:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not verify user'
//             });
//         }

//         if (!userRow) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid user ID'
//             });
//         }

//         // Verify font exists
//         db.get('SELECT font_id FROM fonts WHERE font_id = ?', [fontId], (err, fontRow) => {
//             if (err) {
//                 console.error('Error verifying font:', err);
//                 return res.status(500).json({
//                     success: false,
//                     message: 'Database error: Could not verify font'
//                 });
//             }

//             if (!fontRow) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid font ID'
//                 });
//             }

//             // Insert survey
//             const sql = `INSERT INTO surveys (uid, font_id, decorativeness, vibes, custom_vibes, use_cases, custom_use_cases)
//                          VALUES (?, ?, ?, ?, ?, ?, ?)`;
//             const params = [
//                 uid,
//                 fontId,
//                 decorNum,
//                 JSON.stringify(vibes || []),
//                 JSON.stringify(customVibes || []),
//                 JSON.stringify(useCases || []),
//                 JSON.stringify(customUseCases || [])
//             ];

//             db.run(sql, params, function(err) {
//                 if (err) {
//                     console.error('Error submitting survey:', err);
//                     return res.status(500).json({
//                         success: false,
//                         message: 'Database error: Could not submit survey'
//                     });
//                 }

//                 console.log(`Survey submitted: User ${uid}, Font ${fontId}, Survey ID ${this.lastID}`);
//                 res.json({
//                     success: true,
//                     surveyId: this.lastID,
//                     message: 'Survey submitted successfully'
//                 });
//             });
//         });
//     });
// });

// // 4. Get all survey data (for analysis)
// app.get('/api/admin/surveys', (req, res) => {
//     const sql = `
//         SELECT
//             s.survey_id,
//             s.uid,
//             u.name,
//             u.age,
//             u.gender,
//             u.location,
//             u.profession,
//             u.is_type_designer,
//             u.social_link,
//             s.font_id,
//             f.font_name,
//             f.image_path,
//             s.decorativeness,
//             s.vibes,
//             s.custom_vibes,
//             s.use_cases,
//             s.custom_use_cases,
//             s.created_at
//         FROM surveys s
//         JOIN users u ON s.uid = u.uid
//         JOIN fonts f ON s.font_id = f.font_id
//         ORDER BY s.created_at DESC
//     `;

//     db.all(sql, (err, rows) => {
//         if (err) {
//             console.error('Error fetching surveys:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not fetch surveys'
//             });
//         }

//         // Parse JSON strings back to arrays
//         const surveys = rows.map(row => ({
//             ...row,
//             vibes: JSON.parse(row.vibes),
//             custom_vibes: JSON.parse(row.custom_vibes),
//             use_cases: JSON.parse(row.use_cases),
//             custom_use_cases: JSON.parse(row.custom_use_cases)
//         }));

//         res.json({
//             success: true,
//             surveys: surveys,
//             count: surveys.length
//         });
//     });
// });

// // 5. Export data as CSV
// app.get('/api/admin/export/csv', (req, res) => {
//     const sql = `
//         SELECT
//             s.survey_id,
//             s.uid,
//             u.name,
//             u.age,
//             u.gender,
//             u.location,
//             u.profession,
//             u.is_type_designer,
//             u.social_link,
//             s.font_id,
//             f.font_name,
//             s.decorativeness,
//             s.vibes,
//             s.custom_vibes,
//             s.use_cases,
//             s.custom_use_cases,
//             s.created_at
//         FROM surveys s
//         JOIN users u ON s.uid = u.uid
//         JOIN fonts f ON s.font_id = f.font_id
//         ORDER BY s.created_at DESC
//     `;

//     db.all(sql, (err, rows) => {
//         if (err) {
//             console.error('Error fetching data for export:', err);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not export data'
//             });
//         }

//         // Convert to CSV format
//         let csv = 'survey_id,uid,name,age,gender,location,profession,is_type_designer,social_link,font_id,font_name,decorativeness,vibes,custom_vibes,use_cases,custom_use_cases,created_at\n';

//         rows.forEach(row => {
//             const cleanString = (str) => {
//                 if (!str) return '';
//                 return `"${str.toString().replace(/"/g, '""')}"`;
//             };

//             csv += `${row.survey_id},${row.uid},${cleanString(row.name)},${row.age},${cleanString(row.gender)},${cleanString(row.location)},${cleanString(row.profession)},${row.is_type_designer},${cleanString(row.social_link)},${row.font_id},${cleanString(row.font_name)},${row.decorativeness},${cleanString(row.vibes)},${cleanString(row.custom_vibes)},${cleanString(row.use_cases)},${cleanString(row.custom_use_cases)},${cleanString(row.created_at)}\n`;
//         });

//         res.setHeader('Content-Type', 'text/csv');
//         res.setHeader('Content-Disposition', 'attachment; filename="survey_data.csv"');
//         res.send(csv);
//     });
// });

// // 6. Get database stats
// app.get('/api/admin/stats', (req, res) => {
//     db.serialize(() => {
//         let stats = {};

//         db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
//             if (!err) stats.totalUsers = row.count;
//         });

//         db.get('SELECT COUNT(*) as count FROM surveys', (err, row) => {
//             if (!err) stats.totalSurveys = row.count;
//         });

//         db.get('SELECT COUNT(*) as count FROM fonts', (err, row) => {
//             if (!err) {
//                 stats.totalFonts = row.count;
//                 res.json({ success: true, stats });
//             }
//         });
//     });
// });

// // Serve HTML files
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// app.get('/page2', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'page2.html'));
// });

// app.get('/page3', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'page3.html'));
// });

// app.get('/page4', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'page4.html'));
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//     console.error('Unhandled error:', err.stack);
//     res.status(500).json({
//         success: false,
//         message: 'Internal server error'
//     });
// });

// // 404 handler
// app.use((req, res) => {
//     res.status(404).json({
//         success: false,
//         message: `Route not found: ${req.method} ${req.path}`
//     });
// });

// // Start server
// app.listen(PORT, () => {
//     console.log(`=================================`);
//     console.log(`🚀 Font Survey App Started`);
//     console.log(`📍 Server: http://localhost:${PORT}`);
//     console.log(`📊 Admin Panel: http://localhost:${PORT}/api/admin/surveys`);
//     console.log(`📈 Stats: http://localhost:${PORT}/api/admin/stats`);
//     console.log(`💾 Export CSV: http://localhost:${PORT}/api/admin/export/csv`);
//     console.log(`🔍 Debug Fonts: http://localhost:${PORT}/debug/fonts`);
//     console.log(`📁 Debug Files: http://localhost:${PORT}/debug/files`);
//     console.log(`=================================`);
// });

// // Graceful shutdown
// process.on('SIGINT', () => {
//     console.log('\n🛑 Shutting down gracefully...');
//     db.close((err) => {
//         if (err) {
//             console.error('Error closing database:', err.message);
//         } else {
//             console.log('✅ Database connection closed');
//         }
//         process.exit(0);
//     });
// });

// process.on('SIGTERM', () => {
//     console.log('🛑 SIGTERM received, shutting down gracefully...');
//     db.close(() => {
//         process.exit(0);
//     });
// });
