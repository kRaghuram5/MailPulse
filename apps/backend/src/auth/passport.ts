import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { prisma } from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';

// Serialize user ID into session
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatarUrl = profile.photos?.[0]?.value;

          if (!email) {
            return done(new Error('No email returned from Google'), undefined);
          }

          // Upsert user: create if new, update name/avatar if returning
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              avatarUrl,
            },
            update: {
              name: profile.displayName,
              avatarUrl,
            },
          });

          // Ensure default sender exists so user can immediately schedule emails
          try {
            await prisma.sender.upsert({
              where: { userId_email: { userId: user.id, email: user.email } },
              create: {
                userId: user.id,
                email: user.email,
                displayName: user.name || user.email.split('@')[0],
              },
              update: {
                displayName: user.name || user.email.split('@')[0],
              },
            });
          } catch (senderErr) {
            logger.warn('Could not auto-create default sender for Google user', { error: senderErr });
          }

          logger.info('User authenticated via Google', {
            userId: user.id,
            email: user.email,
          });

          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth strategy error', { error });
          return done(error as Error, undefined);
        }
      },
    ),
  );
} else {
  logger.warn('Google OAuth credentials not set — /api/auth/google will not work');
}

export default passport;
