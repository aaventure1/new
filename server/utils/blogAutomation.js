const BlogPost = require('../models/BlogPost');

/**
 * Sync posts from the configured WordPress API
 */
const syncWordPressPosts = async () => {
    const wpUrl = process.env.WORDPRESS_API_URL || process.env.WORDPRESS_URL;
    if (!wpUrl) {
        console.log('⚠️ WordPress API URL not configured, adding mock data.');
        await addMockPosts();
        return 0;
    }

    try {
        const url = new URL(wpUrl);

        // Accept URLs like /wp-json/wp/v2 and normalize to posts endpoint.
        if (/\/wp\/v2\/?$/.test(url.pathname)) {
            url.pathname = `${url.pathname.replace(/\/$/, '')}/posts`;
        }

        if (!url.searchParams.has('per_page')) url.searchParams.set('per_page', '10');
        if (!url.searchParams.has('_embed')) url.searchParams.set('_embed', '1');

        console.log(`🔄 Syncing posts from ${url.toString()}...`);
        let response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`WordPress API responded with ${response.status}`);
        }

        let wpPosts = await response.json();

        if (!Array.isArray(wpPosts)) {
            // Some configurations return API index metadata instead of posts.
            // Retry once against explicit /posts endpoint before fallback.
            if (!/\/posts\/?$/.test(url.pathname)) {
                url.pathname = `${url.pathname.replace(/\/$/, '')}/posts`;
                response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error(`WordPress posts endpoint responded with ${response.status}`);
                }
                wpPosts = await response.json();
            }
        }

        if (!Array.isArray(wpPosts)) {
            throw new Error('WordPress response was not an array of posts');
        }

        if (wpPosts.length === 0) {
            await addMockPosts();
            return 0;
        }

        let addedCount = 0;

        for (const wpPost of wpPosts) {
            const title = (wpPost?.title?.rendered || 'Untitled')
                .replace(/<[^>]*>/g, '')
                .trim();
            const excerpt = (wpPost?.excerpt?.rendered || '')
                .replace(/<[^>]*>/g, '')
                .trim();
            const content = wpPost?.content?.rendered || excerpt || title;
            const slug = wpPost?.slug || `wp-${wpPost?.id || Date.now()}`;
            const author = wpPost?._embedded?.author?.[0]?.name || 'WordPress';
            const featuredImage = wpPost?._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
            const termNames = (wpPost?._embedded?.['wp:term'] || [])
                .flat()
                .map(term => term?.name || '')
                .filter(Boolean);
            const hasJftCategory = termNames.some(name => /just for today/i.test(name)) || /just for today/i.test(title);
            const category = hasJftCategory ? 'Just For Today' : 'General';

            const result = await BlogPost.updateOne(
                { slug },
                {
                    $setOnInsert: {
                        slug,
                        createdAt: new Date(wpPost?.date || Date.now())
                    },
                    $set: {
                        title,
                        excerpt,
                        content,
                        author,
                        featuredImage,
                        source: 'wordpress',
                        sourceUrl: wpPost?.link || '',
                        wpId: wpPost?.id || null,
                        category,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                addedCount += 1;
            }
        }

        console.log(`✅ WordPress sync complete. Added ${addedCount} new posts.`);
        return addedCount;
    } catch (error) {
        console.error('❌ Error syncing WordPress posts, adding mock data fallback.', error.message);
        await addMockPosts();
        return 0;
    }
};

const addMockPosts = async () => {
    try {
        const existingCount = await BlogPost.countDocuments();
        if (existingCount > 0) return;

        const mockPosts = [
            {
                title: "Just For Today: Acceptance",
                slug: "jft-acceptance",
                excerpt: "Today I will accept life on its own terms. I will not try to force outcomes...",
                content: "Acceptance is not agreement. It is simply acknowledging what is. By accepting my current situation, I find the peace necessary to make healthy changes...",
                author: "Recovery Guide",
                category: "Just For Today",
                featuredImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80"
            },
            {
                title: "5 Tips for Staying Sober During Holidays",
                slug: "sober-holidays",
                excerpt: "The holidays can be a trigger-rich environment. Here is how to navigate them with serenity...",
                content: "1. Have an exit strategy. 2. Keep your sponsor on speed dial. 3. Remember why you started...",
                author: "Community Member",
                category: "General",
                featuredImage: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=800&q=80"
            }
        ];

        for (const post of mockPosts) {
            await BlogPost.updateOne(
                { slug: post.slug },
                { $setOnInsert: post },
                { upsert: true }
            );
        }
        console.log('✅ Mock blog posts added.');
    } catch (e) {
        console.error('Error adding mock posts:', e);
    }
};

module.exports = {
    syncWordPressPosts
};
