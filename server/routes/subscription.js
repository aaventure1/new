const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Subscription pricing (matching 12step-online model)
const SUBSCRIPTION_PLANS = {
    '1month': { price: 2000, duration: 30, name: '1 Month' },
    '2months': { price: 3500, duration: 60, name: '2 Months' },
    '3months': { price: 4500, duration: 90, name: '3 Months' }
};

const isStripeConfigured = () => {
    const key = process.env.STRIPE_SECRET_KEY;
    return Boolean(key && key !== 'sk_test_placeholder');
};

// Get subscription plans
router.get('/plans', (req, res) => {
    res.json({
        success: true,
        plans: Object.keys(SUBSCRIPTION_PLANS).map(key => ({
            id: key,
            name: SUBSCRIPTION_PLANS[key].name,
            price: SUBSCRIPTION_PLANS[key].price / 100,
            duration: SUBSCRIPTION_PLANS[key].duration,
            features: [
                'Court-Ordered Proof of Attendance',
                'Immediate PDF Certificates',
                'Attendance Tracking',
                'Verification Support',
                'Access to All Meetings'
            ]
        }))
    });
});

const resolveBaseUrl = (req) => {
    if (process.env.BASE_URL) return process.env.BASE_URL;
    return `${req.protocol}://${req.get('host')}`;
};

// Create checkout session
router.post('/create-checkout', auth, async (req, res) => {
    try {
        const { planId } = req.body;

        if (!SUBSCRIPTION_PLANS[planId]) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        const plan = SUBSCRIPTION_PLANS[planId];
        const baseUrl = resolveBaseUrl(req);

        // If Stripe keys are placeholders, return a special error or a demo URL
        if (!isStripeConfigured()) {
            console.log('⚠️ Stripe key is placeholder. Providing demo bypass link.');
            return res.json({
                success: true,
                isDemo: true,
                url: `${baseUrl}/subscription-success?session_id=DEMO_${Date.now()}&planId=${planId}`
            });
        }

        // Create or retrieve Stripe customer
        let customerId = req.user.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                metadata: {
                    userId: req.user._id.toString()
                }
            });
            customerId = customer.id;
            req.user.stripeCustomerId = customerId;
            await req.user.save();
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `AAVenture Subscription - ${plan.name}`,
                        description: 'Access to proof of attendance certificates and all features'
                    },
                    unit_amount: plan.price
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}&planId=${planId}`,
            cancel_url: `${baseUrl}/subscription`,
            metadata: {
                userId: req.user._id.toString(),
                planId: planId,
                duration: plan.duration.toString()
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('Create checkout error:', error);
        res.status(500).json({ error: 'Server error creating checkout session' });
    }
});

// Demo subscription (for testing/bypass when Stripe keys aren't set)
router.get('/demo-success', auth, async (req, res) => {
    try {
        const demoAllowed = !isStripeConfigured() || process.env.ALLOW_DEMO_SUBSCRIPTIONS === 'true';
        if (!demoAllowed) {
            return res.status(403).json({
                error: 'Demo subscriptions are disabled in this environment'
            });
        }

        const { planId } = req.query;
        const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS['1month'];

        const duration = plan.duration;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + duration);

        req.user.subscription = 'premium';
        req.user.subscriptionExpiry = expiryDate;
        await req.user.save();

        console.log(`Demo subscription activated for user ${req.user._id} until ${expiryDate}`);

        res.json({ success: true, message: 'Premium status activated via demo bypass' });
    } catch (error) {
        console.error('Demo success error:', error);
        res.status(500).json({ error: 'Failed to activate demo subscription' });
    }
});

// Webhook to handle successful payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig) {
        return res.status(400).send('Webhook Error: Missing stripe-signature');
    }

    if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
        console.error('Webhook secret is not set appropriately');
        return res.status(400).send('Webhook Error: Secret not configured');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            const userId = session.metadata.userId;
            const duration = parseInt(session.metadata.duration, 10) || 30;

            const user = await User.findById(userId);
            if (user) {
                // Calculate expiry date
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + duration);

                user.subscription = 'premium';
                user.subscriptionExpiry = expiryDate;
                await user.save();

                console.log(`Subscription activated for user ${userId} until ${expiryDate}`);
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
        }
    }

    res.json({ received: true });
});

// Check subscription status
router.get('/status', auth, async (req, res) => {
    try {
        const hasActive = req.user.hasActiveSubscription();

        res.json({
            success: true,
            subscription: {
                type: req.user.subscription,
                isActive: hasActive,
                expiryDate: req.user.subscriptionExpiry,
                daysRemaining: hasActive ?
                    Math.ceil((req.user.subscriptionExpiry - new Date()) / (1000 * 60 * 60 * 24)) : 0
            }
        });
    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
