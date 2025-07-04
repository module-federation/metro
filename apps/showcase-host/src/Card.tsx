import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  description?: string;
};

export default function Card({
  children,
  title,
  description,
}: React.PropsWithChildren<Props>) {
  return (
    <View style={styles.mainContainer}>
      <View style={styles.miniappSection}>
        <View style={styles.miniappCaption}>
          <Text style={styles.miniappTitle}>{title}</Text>
          {description ? (
            <Text style={styles.miniappDescription}>{description}</Text>
          ) : null}
        </View>
        <View style={styles.miniappHighlight}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniappSection: {
    width: '100%',
    maxWidth: 400,
    marginVertical: 20,
    zIndex: 1,
  },
  miniappCaption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  miniappHighlight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    padding: 20,
    minHeight: 150,
  },
  miniappTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  miniappDescription: {
    fontSize: 14,
    color: '#a1a1aa',
  },
});
