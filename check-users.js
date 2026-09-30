const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('\n========================================');
    console.log('📊 Checking Database Users');
    console.log('========================================\n');

    const users = await prisma.user.findMany({
      include: {
        subscriptions: true,
        otps: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('\n💡 Please register a new user at: http://localhost:3000/register\n');
    } else {
      console.log(`✅ Found ${users.length} user(s):\n`);
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. User Details:`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👤 Name: ${user.name}`);
        console.log(`   ✓ Verified: ${user.isVerified ? '✅ Yes' : '❌ No'}`);
        console.log(`   📱 Phone: ${user.phone || 'Not provided'}`);
        console.log(`   🌍 Region: ${user.region || 'Not specified'}`);
        console.log(`   📅 Created: ${user.createdAt.toLocaleString()}`);
        
        if (user.subscriptions.length > 0) {
          const activeSub = user.subscriptions.find(s => s.status === 'active');
          if (activeSub) {
            console.log(`   💳 Subscription: ${activeSub.plan} (${activeSub.isTrial ? 'Trial' : 'Paid'})`);
            console.log(`   ⏰ Expires: ${activeSub.endDate.toLocaleDateString()}`);
          }
        }
        
        if (user.otps.length > 0 && !user.isVerified) {
          const latestOtp = user.otps[0];
          console.log(`   🔑 Latest OTP: ${latestOtp.code}`);
          console.log(`   ⏱️  OTP Expires: ${latestOtp.expiresAt.toLocaleString()}`);
          console.log(`   📝 OTP Used: ${latestOtp.isUsed ? 'Yes' : 'No'}`);
        }
        
        console.log('');
      });
    }

    console.log('========================================\n');
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
