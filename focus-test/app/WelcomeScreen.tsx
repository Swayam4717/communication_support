import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "./communicationCommon";

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeHeroCard}>
        <Text style={styles.welcomeHeroEmoji}>💬</Text>
        <Text style={styles.welcomeHeroTitle}>Calm Communication</Text>
        <Text style={styles.welcomeHeroSubtitle}>
          A gentle way for parents and children to connect
        </Text>
      </View>

      <View style={styles.welcomeFeaturesCard}>
        <View style={styles.featureRow}>
          <Text style={styles.featureEmoji}>🧑‍🧒</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>For Parents</Text>
            <Text style={styles.featureText}>
              Create simple, structured sessions for your child to respond to
            </Text>
          </View>
        </View>

        <View style={styles.featureDivider} />

        <View style={styles.featureRow}>
          <Text style={styles.featureEmoji}>👦</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>For Children</Text>
            <Text style={styles.featureText}>
              Respond with visual choices in a calm, low-pressure environment
            </Text>
          </View>
        </View>

        <View style={styles.featureDivider} />

        <View style={styles.featureRow}>
          <Text style={styles.featureEmoji}>📱</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Connected Devices</Text>
            <Text style={styles.featureText}>
              Parent and child devices sync in real time over one shared room
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onGetStarted}>
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
