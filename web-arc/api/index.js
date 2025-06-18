// const express = require('express');
// const { createClient } = require('@supabase/supabase-js');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');

// const app = express();

// // FIXED: Removed process.exit(1) that crashes serverless functions
// // Instead, just log the error - Vercel will handle missing env vars
// if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
//     console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
// }

// // Supabase configuration
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

// // Middleware
// app.use(cors({
//     origin: ['http://localhost:3000', 'https://*.vercel.app'],
//     credentials: true
// }));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // FIXED: Updated static file path for Vercel structure
// app.use(express.static(path.join(__dirname, '..', 'public')));

// // API Routes

// // 1. Create new user
// // app.post('/api/users', async (req, res) => {
// //     const { name, age, gender, location, profession, isTypeDesigner, socialLink } = req.body;
    
// //     if (!name || !age || !gender || !location || !profession || isTypeDesigner === undefined) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'All required fields must be provided'
// //         });
// //     }

// //     const ageNum = parseInt(age);
// //     if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
// //         return res.status(400).json({
// //             success: false,
// //             message: 'Please enter a valid age between 1 and 120'
// //         });
// //     }

// //     try {
// //         const { data, error } = await supabase
// //             .from('users')
// //             .insert([{
// //                 name,
// //                 age: ageNum,
// //                 gender,
// //                 location,
// //                 profession,
// //                 is_type_designer: isTypeDesigner === 'yes',
// //                 social_link: socialLink || null
// //             }])
// //             .select()
// //             .single();

// //         if (error) {
// //             console.error('Error creating user:', error);
// //             return res.status(500).json({
// //                 success: false,
// //                 message: 'Database error: Could not create user'
// //             });
// //         }

// //         res.json({
// //             success: true,
// //             uid: data.uid,
// //             message: 'User created successfully'
// //         });
// //     } catch (error) {
// //         console.error('Error creating user:', error);
// //         return res.status(500).json({
// //             success: false,
// //             message: 'Database error: Could not create user'
// //         });
// //     }
// // });
// app.post('/api/users', async (req, res) => {
//     const { name, age, gender, location, profession, isTypeDesigner, socialLink } = req.body;
    
//     if (!name || !age || !gender || !location || !profession || isTypeDesigner === undefined) {
//         return res.status(400).json({
//             success: false,
//             message: 'All required fields must be provided'
//         });
//     }

//     const ageNum = parseInt(age);
//     if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
//         return res.status(400).json({
//             success: false,
//             message: 'Please enter a valid age between 1 and 120'
//         });
//     }

//     try {
//         console.log('Attempting to create user with data:', {
//             name,
//             age: ageNum,
//             gender,
//             location,
//             profession,
//             is_type_designer: isTypeDesigner === 'yes',
//             social_link: socialLink || null
//         });

//         const { data, error } = await supabase
//             .from('users')
//             .insert([{
//                 name,
//                 age: ageNum,
//                 gender,
//                 location,
//                 profession,
//                 is_type_designer: isTypeDesigner === 'yes',
//                 social_link: socialLink || null
//             }])
//             .select()
//             .single();

//         if (error) {
//             console.error('Detailed Supabase error:', {
//                 code: error.code,
//                 message: error.message,
//                 details: error.details,
//                 hint: error.hint
//             });
            
//             // Handle specific RLS error
//             if (error.code === '42501') {
//                 return res.status(403).json({
//                     success: false,
//                     message: 'Database access denied. Please check RLS policies.',
//                     error: 'RLS_POLICY_VIOLATION'
//                 });
//             }
            
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not create user',
//                 error: error.message
//             });
//         }

//         console.log('User created successfully:', data);
        
//         res.json({
//             success: true,
//             uid: data.uid,
//             message: 'User created successfully'
//         });
//     } catch (error) {
//         console.error('Unexpected error creating user:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Unexpected error: Could not create user',
//             error: error.message
//         });
//     }
// });
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Environment variables check
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
}

// Check for service role key
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found. Using anon key for server operations.');
}

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create two clients: one for public operations, one for admin operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://*.vercel.app'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. Create new user - Use admin client to bypass RLS issues
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

    try {
        console.log('Attempting to create user with data:', {
            name,
            age: ageNum,
            gender,
            location,
            profession,
            is_type_designer: isTypeDesigner === 'yes',
            social_link: socialLink || null
        });

        // Use admin client for server-side operations
        const { data, error } = await supabaseAdmin
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
            console.error('Detailed Supabase error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            
            return res.status(500).json({
                success: false,
                message: 'Database error: Could not create user',
                error: error.message,
                code: error.code
            });
        }

        console.log('User created successfully:', data);
        
        res.json({
            success: true,
            uid: data.uid,
            message: 'User created successfully'
        });
    } catch (error) {
        console.error('Unexpected error creating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Unexpected error: Could not create user',
            error: error.message
        });
    }
});
// 2. Get random font
app.get('/api/fonts/random', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error fetching fonts:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not fetch fonts'
        });
    }
});

// 3. Submit survey
// 3. Submit survey - Updated with admin client and better error handling
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

    try {
        console.log('Attempting to create survey with data:', {
            uid,
            font_id: fontId,
            decorativeness: decorNum,
            vibes: vibes || [],
            custom_vibes: customVibes || [],
            use_cases: useCases || [],
            custom_use_cases: customUseCases || []
        });

        // Use admin client to bypass RLS issues
        const { data, error } = await supabaseAdmin
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
            console.error('Detailed Supabase error for survey:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            
            // Handle specific RLS error
            if (error.code === '42501') {
                return res.status(403).json({
                    success: false,
                    message: 'Database access denied. Please check RLS policies for surveys table.',
                    error: 'RLS_POLICY_VIOLATION'
                });
            }
            
            // Handle foreign key constraint errors
            if (error.code === '23503') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid UID or Font ID provided',
                    error: 'FOREIGN_KEY_VIOLATION'
                });
            }
            
            return res.status(500).json({
                success: false,
                message: 'Database error: Could not submit survey',
                error: error.message,
                code: error.code
            });
        }

        console.log('Survey created successfully:', data);

        res.json({
            success: true,
            surveyId: data.survey_id,
            message: 'Survey submitted successfully'
        });
    } catch (error) {
        console.error('Unexpected error submitting survey:', error);
        return res.status(500).json({
            success: false,
            message: 'Unexpected error: Could not submit survey',
            error: error.message
        });
    }
});
// app.post('/api/surveys', async (req, res) => {
//     const {
//         uid,
//         fontId,
//         decorativeness,
//         vibes,
//         customVibes,
//         useCases,
//         customUseCases
//     } = req.body;

//     if (!uid || !fontId || decorativeness === undefined) {
//         return res.status(400).json({
//             success: false,
//             message: 'UID, fontID, and decorativeness are required'
//         });
//     }

//     const decorNum = parseInt(decorativeness);
//     if (isNaN(decorNum) || decorNum < 0 || decorNum > 9) {
//         return res.status(400).json({
//             success: false,
//             message: 'Decorativeness must be a number between 0 and 9'
//         });
//     }

//     try {
//         const { data, error } = await supabase
//             .from('surveys')
//             .insert([{
//                 uid,
//                 font_id: fontId,
//                 decorativeness: decorNum,
//                 vibes: vibes || [],
//                 custom_vibes: customVibes || [],
//                 use_cases: useCases || [],
//                 custom_use_cases: customUseCases || []
//             }])
//             .select()
//             .single();

//         if (error) {
//             console.error('Error submitting survey:', error);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error: Could not submit survey'
//             });
//         }

//         res.json({
//             success: true,
//             surveyId: data.survey_id,
//             message: 'Survey submitted successfully'
//         });
//     } catch (error) {
//         console.error('Error submitting survey:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Database error: Could not submit survey'
//         });
//     }
// });

// 4. Get all survey data (for analysis)
app.get('/api/admin/surveys', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error fetching surveys:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error: Could not fetch surveys'
        });
    }
});

// 5. Export data as CSV
app.get('/api/admin/export/csv', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error exporting data:', error);
        return res.status(500).json({
            success: false,
            message: 'Could not export data'
        });
    }
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

// FIXED: Removed HTML route handlers - these are now served statically from public/
// The Vercel routing will handle serving HTML files from the public folder

// FIXED: Removed app.listen() call - not needed in serverless environment
// Export the Express app for Vercel to use
module.exports = app;
